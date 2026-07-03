import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class AccorderingDto {
  @IsBoolean()
  akkoord: boolean;

  @IsOptional()
  @IsString()
  toelichting?: string;
}
