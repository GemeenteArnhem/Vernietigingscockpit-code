import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateReviewregelDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  uitzonderingsreden?: string;

  @IsOptional()
  @IsString()
  toelichting?: string;
}

export class MarkeerBeoordeeldDto {
  @IsArray()
  @IsString({ each: true })
  reviewregelIds: string[];
}

export class ReviewregelQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  zoekterm?: string;

  @IsOptional()
  @IsBoolean()
  alleenUitzonderingen?: boolean;
}
