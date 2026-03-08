-- Move chat domain objects to the "chat" schema without dropping data.
CREATE SCHEMA IF NOT EXISTS "chat";

-- Move enums used by chat messages.
ALTER TYPE "public"."MessageRole" SET SCHEMA "chat";
ALTER TYPE "public"."MessageStatus" SET SCHEMA "chat";

-- Move chat tables (data, indexes and constraints are preserved).
ALTER TABLE "public"."chats" SET SCHEMA "chat";
ALTER TABLE "public"."messages" SET SCHEMA "chat";
