import { Module } from '@nestjs/common';

import { GuardsModule } from './common/guards/guards.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditLogModule } from './common/audit-log.module';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from './modules/config/config.module';
import { FilesModule } from './modules/files/files.module';
import { PatentsModule } from './modules/patents/patents.module';
import { PatentMapModule } from './modules/patent-map/patent-map.module';
import { RegionsModule } from './modules/regions/regions.module';
import { UsersModule } from './modules/users/users.module';
import { ListingsModule } from './modules/listings/listings.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { CommentsModule } from './modules/comments/comments.module';
import { DemandsModule } from './modules/demands/demands.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { ArtworksModule } from './modules/artworks/artworks.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { TechManagersModule } from './modules/tech-managers/tech-managers.module';
import { InventorsModule } from './modules/inventors/inventors.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { CasesModule } from './modules/cases/cases.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';

@Module({
  imports: [
    PrismaModule,
    AuditLogModule,
    GuardsModule,
    AuthModule,
    ConfigModule,
    RegionsModule,
    PatentMapModule,
    UsersModule,
    FilesModule,
    PatentsModule,
    ListingsModule,
    OrdersModule,
    ConversationsModule,
    CommentsModule,
    DemandsModule,
    AchievementsModule,
    ArtworksModule,
    FavoritesModule,
    AnnouncementsModule,
    NotificationsModule,
    ContractsModule,
    OrganizationsModule,
    TechManagersModule,
    InventorsModule,
    AddressesModule,
    CasesModule,
    RbacModule,
    ReportsModule,
    AuditLogsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
