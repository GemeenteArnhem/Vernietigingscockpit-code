import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { DatabaseModule } from "../../shared/db/database.module.js";
import { CurrentMedewerkerService } from "./current-medewerker.service.js";
import { JwtStrategy } from "./jwt.strategy.js";

@Module({
  imports: [DatabaseModule, PassportModule.register({ defaultStrategy: "jwt" })],
  providers: [CurrentMedewerkerService, JwtStrategy],
  exports: [CurrentMedewerkerService],
})
export class AuthModule {}
