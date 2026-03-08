-- Move users domain objects to the "users" schema without dropping data.
CREATE SCHEMA IF NOT EXISTS "users";

-- Move enums to the users schema (only used by User).
ALTER TYPE "public"."UserRole" SET SCHEMA "users";
ALTER TYPE "public"."AuthProvider" SET SCHEMA "users";

-- Move tables to the users schema (keeps data and foreign keys).
ALTER TABLE "public"."tenants" SET SCHEMA "users";
ALTER TABLE "public"."users" SET SCHEMA "users";
