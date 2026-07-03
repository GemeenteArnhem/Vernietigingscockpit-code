import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    this.pool = new Pool({
      connectionString: configService.get<string>('DATABASE_URL'),
      host: configService.get<string>('POSTGRES_HOST') ?? 'localhost',
      port: configService.get<number>('POSTGRES_PORT') ?? 5432,
      database: configService.get<string>('POSTGRES_DB') ?? 'vernietigingscockpit',
      user: configService.get<string>('POSTGRES_USER') ?? 'postgres',
      password: configService.get<string>('POSTGRES_PASSWORD') ?? 'postgres',
      max: configService.get<number>('POSTGRES_POOL_SIZE') ?? 10,
    });
  }

  query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params);
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
