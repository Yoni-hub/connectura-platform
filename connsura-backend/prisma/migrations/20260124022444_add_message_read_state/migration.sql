-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "deletedForAgentAt" TIMESTAMP(3),
ADD COLUMN     "deletedForCustomerAt" TIMESTAMP(3),
ADD COLUMN     "readByAgentAt" TIMESTAMP(3),
ADD COLUMN     "readByCustomerAt" TIMESTAMP(3);
