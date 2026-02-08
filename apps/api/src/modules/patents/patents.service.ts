import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

type PatentNumberInputType = 'APPLICATION_NO' | 'PATENT_NO' | 'PUBLICATION_NO';

type PatentNormalizeResponseDto = {
  jurisdiction: 'CN';
  inputType: PatentNumberInputType;
  applicationNoNorm?: string;
  applicationNoDisplay?: string;
  publicationNoNorm?: string;
  publicationNoDisplay?: string;
  patentNoNorm?: string;
  patentNoDisplay?: string;
  kindCode?: string;
  patentType?: 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN';
  warnings?: string[];
};

type PatentDto = {
  id: string;
  jurisdiction: 'CN';
  applicationNoNorm: string;
  applicationNoDisplay?: string;
  publicationNoDisplay?: string;
  patentNoDisplay?: string;
  grantPublicationNoDisplay?: string;
  patentType: 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN';
  title: string;
  abstract?: string;
  inventorNames?: string[];
  assigneeNames?: string[];
  applicantNames?: string[];
  filingDate?: string;
  publicationDate?: string;
  grantDate?: string;
  legalStatus?: 'PENDING' | 'GRANTED' | 'EXPIRED' | 'INVALIDATED' | 'UNKNOWN';
  sourcePrimary?: 'USER' | 'ADMIN' | 'PROVIDER';
  sourceUpdatedAt?: string;
  transferCount?: number;
  createdAt: string;
  updatedAt: string;
};

type LegalStatusDto = NonNullable<PatentDto['legalStatus']>;

const PATENT_PARTY_ROLE = {
  INVENTOR: 'INVENTOR',
  ASSIGNEE: 'ASSIGNEE',
  APPLICANT: 'APPLICANT',
} as const;

type PatentParty = {
  role: string;
  name: string;
};

function toHalfWidth(input: string): string {
  let outputText = '';
  for (const character of input) {
    const charCode = character.charCodeAt(0);
    if (charCode === 0x3000) {
      outputText += ' ';
      continue;
    }
    if (charCode >= 0xff01 && charCode <= 0xff5e) {
      outputText += String.fromCharCode(charCode - 0xfee0);
      continue;
    }
    outputText += character;
  }
  return outputText;
}

function cleanRaw(raw: string): string {
  let cleanedValue = toHalfWidth(String(raw || '')).trim();
  cleanedValue = cleanedValue.toUpperCase();
  cleanedValue = cleanedValue.replace(/(专利申请号|专利号|申请号|公开号|公告号|公开\(公告\)号)/g, '');
  cleanedValue = cleanedValue.replace(/[:：]/g, '');
  cleanedValue = cleanedValue.replace(/[\s\-_，,、；;（）()【】\[\]]/g, '');
  return cleanedValue;
}

function digitToPatentType(typeDigit: string): 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN' | null {
  if (typeDigit === '1') return 'INVENTION';
  if (typeDigit === '2') return 'UTILITY_MODEL';
  if (typeDigit === '3') return 'DESIGN';
  return null;
}

function kindToPatentType(kind: string): 'INVENTION' | 'UTILITY_MODEL' | 'DESIGN' | null {
  const normalizedKind = String(kind || '').toUpperCase();
  if (normalizedKind.startsWith('U')) return 'UTILITY_MODEL';
  if (normalizedKind.startsWith('S')) return 'DESIGN';
  if (normalizedKind.startsWith('A') || normalizedKind.startsWith('B')) return 'INVENTION';
  return null;
}

function toApplicationDisplay(normDigits: string): string {
  const digitsOnly = String(normDigits || '').replace(/\D/g, '');
  if (digitsOnly.length < 2) return digitsOnly;
  return `${digitsOnly.slice(0, -1)}.${digitsOnly.slice(-1)}`;
}

@Injectable()
export class PatentsService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeNumber(raw?: string): PatentNormalizeResponseDto {
    const cleanedInput = cleanRaw(String(raw || ''));
    if (!cleanedInput) throw new BadRequestException({ code: 'BAD_REQUEST', message: 'raw 不能为空' });

    const warnings: string[] = [];

    const isPatentNo = cleanedInput.startsWith('ZL') || cleanedInput.startsWith('CNZL');
    const withoutPrefix = cleanedInput.replace(/^CN/, '').replace(/^ZL/, '');
    const cleanedDigits = withoutPrefix.replace(/\./g, '');

    if (
      /^(19\d{2}|20\d{2})[123]\d{7}\d$/.test(cleanedDigits) ||
      /^\d{2}[123]\d{5}\d$/.test(cleanedDigits)
    ) {
      const patentTypeDigit =
        cleanedDigits.startsWith('19') || cleanedDigits.startsWith('20')
          ? cleanedDigits.slice(4, 5)
          : cleanedDigits.slice(2, 3);
      const patentType = digitToPatentType(patentTypeDigit);
      if (!patentType) warnings.push('无法从号码类型位推断专利类型');

      const applicationNoNorm = cleanedDigits;
      const applicationNoDisplay = toApplicationDisplay(cleanedDigits);

      const normalizeResult: PatentNormalizeResponseDto = {
        jurisdiction: 'CN',
        inputType: isPatentNo ? 'PATENT_NO' : 'APPLICATION_NO',
        applicationNoNorm,
        applicationNoDisplay,
        patentType: patentType ?? undefined,
        warnings: warnings.length ? warnings : undefined,
      };

      if (isPatentNo) {
        normalizeResult.patentNoNorm = `ZL${applicationNoNorm}`;
        normalizeResult.patentNoDisplay = `ZL${applicationNoDisplay}`;
      }

      return normalizeResult;
    }

    const publicationMatch = cleanedInput.match(/^(?:CN)?(\d{7,9})([A-Z]\d?)$/);
    if (publicationMatch) {
      const publicationNumber = publicationMatch[1];
      const kindCode = publicationMatch[2];
      const publicationNoNorm = `CN${publicationNumber}${kindCode}`;
      const patentType = kindToPatentType(kindCode);
      if (!patentType) warnings.push('无法从文献种类代码推断专利类型（以数据源为准）');
      return {
        jurisdiction: 'CN',
        inputType: 'PUBLICATION_NO',
        publicationNoNorm,
        publicationNoDisplay: publicationNoNorm,
        kindCode,
        patentType: patentType ?? undefined,
        warnings: warnings.length ? warnings : undefined,
      };
    }

    throw new BadRequestException({ code: 'BAD_REQUEST', message: '无法识别专利号码格式' });
  }

  async getPatentById(patentId: string): Promise<PatentDto> {
    const patentRecord = await this.prisma.patent.findUnique({
      where: { id: String(patentId) },
      include: { parties: true },
    });
    if (!patentRecord) throw new NotFoundException({ code: 'NOT_FOUND', message: '专利不存在' });

    const parties = (patentRecord.parties ?? []) as PatentParty[];
    const inventorNames = parties
      .filter((party: PatentParty) => party.role === PATENT_PARTY_ROLE.INVENTOR)
      .map((party: PatentParty) => party.name);
    const assigneeNames = parties
      .filter((party: PatentParty) => party.role === PATENT_PARTY_ROLE.ASSIGNEE)
      .map((party: PatentParty) => party.name);
    const applicantNames = parties
      .filter((party: PatentParty) => party.role === PATENT_PARTY_ROLE.APPLICANT)
      .map((party: PatentParty) => party.name);

    const toDate = (dateValue?: Date | null) => (dateValue ? dateValue.toISOString().slice(0, 10) : undefined);
    const toDateTime = (dateValue?: Date | null) => (dateValue ? dateValue.toISOString() : undefined);
    const legal = patentRecord.legalStatus ? String(patentRecord.legalStatus).toUpperCase() : '';
    const legalStatus =
      legal && ['PENDING', 'GRANTED', 'EXPIRED', 'INVALIDATED', 'UNKNOWN'].includes(legal)
        ? (legal as LegalStatusDto)
        : undefined;

    const patentAny = patentRecord as any;
    return {
      id: patentRecord.id,
      jurisdiction: 'CN',
      applicationNoNorm: patentRecord.applicationNoNorm,
      applicationNoDisplay: patentRecord.applicationNoDisplay ?? undefined,
      publicationNoDisplay: patentAny.publicationNoDisplay ?? undefined,
      patentNoDisplay: patentAny.patentNoDisplay ?? undefined,
      grantPublicationNoDisplay: patentAny.grantPublicationNoDisplay ?? undefined,
      patentType: patentRecord.patentType,
      title: patentRecord.title,
      abstract: patentRecord.abstract ?? undefined,
      inventorNames: inventorNames.length ? inventorNames : undefined,
      assigneeNames: assigneeNames.length ? assigneeNames : undefined,
      applicantNames: applicantNames.length ? applicantNames : undefined,
      filingDate: toDate(patentRecord.filingDate),
      publicationDate: toDate(patentRecord.publicationDate),
      grantDate: toDate(patentRecord.grantDate),
      legalStatus,
      sourcePrimary: patentRecord.sourcePrimary,
      sourceUpdatedAt: toDateTime(patentRecord.sourceUpdatedAt),
      transferCount: typeof patentAny.transferCount === 'number' ? patentAny.transferCount : undefined,
      createdAt: patentRecord.createdAt.toISOString(),
      updatedAt: patentRecord.updatedAt.toISOString(),
    };
  }
}
