import { IsOptional, IsString } from 'class-validator';

export class StartSelectieDto {
  @IsOptional()
  @IsString()
  peildatum?: string;
}

export class StartVernietigingDto {
  @IsOptional()
  @IsString()
  reden?: string;
}
