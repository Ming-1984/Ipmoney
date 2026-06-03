export type FaqItem = {
  id: string;
  category: string;
  q: string;
  a: string;
  keywords?: string[];
};

export const FAQS: FaqItem[] = [
  {
    id: 'contract-sign',
    category: '合同与材料',
    q: '为什么需要签署合同？',
    a: '平台会根据交易信息生成标准合同，明确双方权利义务并留存交易凭证，便于后续权属变更与争议处理。',
    keywords: ['合同', '签署', '材料'],
  },
  {
    id: 'deposit-refund-window',
    category: '订金与退款',
    q: '订金支付后多久可以申请退款？',
    a: '订金支付后，如在平台规则约定的退款窗口内且满足相应条件，可发起退款或售后流程，具体以交易规则页面展示为准。',
    keywords: ['订金', '退款'],
  },
  {
    id: 'final-payment-time',
    category: '尾款与托管',
    q: '尾款什么时候需要支付？',
    a: '当订单进入尾款支付节点时，平台会提示买家完成尾款支付。尾款由平台托管，待权属变更完成确认后再进行放款。',
    keywords: ['尾款', '托管', '放款'],
  },
  {
    id: 'invoice',
    category: '合同与发票',
    q: '发票如何申请与下载？',
    a: '订单完成后，买家可在“订单管理 → 发票管理”查看发票状态并下载电子发票。',
    keywords: ['发票', '下载'],
  },
  {
    id: 'identity-audit',
    category: '登录与认证',
    q: '身份认证审核需要多久？',
    a: '提交认证后通常会在 1 至 3 个工作日内完成审核；如材料不完整，平台会提示补充。也可通过客服渠道查询审核进度。',
    keywords: ['认证', '审核'],
  },
];
