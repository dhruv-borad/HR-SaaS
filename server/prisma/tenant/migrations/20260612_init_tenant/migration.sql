-- Tenant database init migration.
-- Creates all operational tables for an isolated customer database.
-- No Tenant table here; that lives in the admin DB.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE');
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'MANAGER_APPROVED', 'APPROVED', 'REJECTED');
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'FINALISED');

-- CreateTable: User
CREATE TABLE "User" (
    "id"                        TEXT         NOT NULL,
    "tenantId"                  TEXT         NOT NULL,
    "email"                     TEXT         NOT NULL,
    "passwordHash"              TEXT         NOT NULL,
    "firstName"                 TEXT         NOT NULL,
    "lastName"                  TEXT         NOT NULL,
    "role"                      "Role"       NOT NULL DEFAULT 'EMPLOYEE',
    "department"                TEXT,
    "salaryAnnual"              DECIMAL(12,2) NOT NULL DEFAULT 0,
    "travelMaxCostPerTrip"      DECIMAL(12,2),
    "travelAllowedDestinations" TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    "managerId"                 TEXT,
    "mustChangePassword"        BOOLEAN      NOT NULL DEFAULT true,
    "active"                    BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LeaveType
CREATE TABLE "LeaveType" (
    "id"          TEXT          NOT NULL,
    "tenantId"    TEXT          NOT NULL,
    "name"        TEXT          NOT NULL,
    "daysPerYear" DECIMAL(6,2)  NOT NULL DEFAULT 0,
    "paid"        BOOLEAN       NOT NULL DEFAULT true,
    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LeaveBalance
CREATE TABLE "LeaveBalance" (
    "id"          TEXT         NOT NULL,
    "tenantId"    TEXT         NOT NULL,
    "userId"      TEXT         NOT NULL,
    "leaveTypeId" TEXT         NOT NULL,
    "balance"     DECIMAL(6,2) NOT NULL DEFAULT 0,
    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LeaveRequest
CREATE TABLE "LeaveRequest" (
    "id"               TEXT             NOT NULL,
    "tenantId"         TEXT             NOT NULL,
    "userId"           TEXT             NOT NULL,
    "leaveTypeId"      TEXT             NOT NULL,
    "startDate"        TIMESTAMP(3)     NOT NULL,
    "endDate"          TIMESTAMP(3)     NOT NULL,
    "days"             DECIMAL(6,2)     NOT NULL,
    "notes"            TEXT,
    "status"           "RequestStatus"  NOT NULL DEFAULT 'PENDING',
    "decisionNote"     TEXT,
    "decidedById"      TEXT,
    "decidedAt"        TIMESTAMP(3),
    "payrollDeduction" BOOLEAN          NOT NULL DEFAULT false,
    "createdAt"        TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TravelRequest
CREATE TABLE "TravelRequest" (
    "id"               TEXT             NOT NULL,
    "tenantId"         TEXT             NOT NULL,
    "userId"           TEXT             NOT NULL,
    "destination"      TEXT             NOT NULL,
    "startDate"        TIMESTAMP(3)     NOT NULL,
    "endDate"          TIMESTAMP(3)     NOT NULL,
    "purpose"          TEXT             NOT NULL,
    "estimatedCost"    DECIMAL(12,2)    NOT NULL,
    "fullPrice"        DECIMAL(12,2),
    "actualSpend"      DECIMAL(12,2)    NOT NULL DEFAULT 0,
    "policyCompliant"  BOOLEAN,
    "policyNotes"      TEXT,
    "status"           "RequestStatus"  NOT NULL DEFAULT 'PENDING',
    "decisionNote"     TEXT,
    "decidedById"      TEXT,
    "decidedAt"        TIMESTAMP(3),
    "bookingConfirmed" BOOLEAN          NOT NULL DEFAULT false,
    "createdAt"        TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TravelRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ExpenseClaim
CREATE TABLE "ExpenseClaim" (
    "id"                 TEXT            NOT NULL,
    "tenantId"           TEXT            NOT NULL,
    "userId"             TEXT            NOT NULL,
    "amount"             DECIMAL(12,2)   NOT NULL,
    "category"           TEXT            NOT NULL,
    "description"        TEXT,
    "receiptKey"         TEXT,
    "status"             "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "managerDecidedById" TEXT,
    "managerDecidedAt"   TIMESTAMP(3),
    "financeDecidedById" TEXT,
    "financeDecidedAt"   TIMESTAMP(3),
    "decisionNote"       TEXT,
    "travelRequestId"    TEXT,
    "payrollItemId"      TEXT,
    "createdAt"          TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PayrollRun
CREATE TABLE "PayrollRun" (
    "id"          TEXT            NOT NULL,
    "tenantId"    TEXT            NOT NULL,
    "year"        INTEGER         NOT NULL,
    "month"       INTEGER         NOT NULL,
    "status"      "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalisedAt" TIMESTAMP(3),
    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PayrollItem
CREATE TABLE "PayrollItem" (
    "id"               TEXT         NOT NULL,
    "tenantId"         TEXT         NOT NULL,
    "runId"            TEXT         NOT NULL,
    "userId"           TEXT         NOT NULL,
    "baseSalary"       DECIMAL(12,2) NOT NULL,
    "expenseAdditions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "leaveDeductions"  DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netPay"           DECIMAL(12,2) NOT NULL,
    "payslipKey"       TEXT,
    CONSTRAINT "PayrollItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ApprovalWorkflow
CREATE TABLE "ApprovalWorkflow" (
    "id"          TEXT   NOT NULL,
    "tenantId"    TEXT   NOT NULL,
    "requestType" TEXT   NOT NULL,
    "approverRole" "Role" NOT NULL DEFAULT 'MANAGER',
    CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AuditLog
CREATE TABLE "AuditLog" (
    "id"         TEXT         NOT NULL,
    "tenantId"   TEXT         NOT NULL,
    "entityType" TEXT         NOT NULL,
    "entityId"   TEXT         NOT NULL,
    "action"     TEXT         NOT NULL,
    "actorId"    TEXT,
    "detail"     TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE UNIQUE INDEX "LeaveType_tenantId_name_key" ON "LeaveType"("tenantId", "name");
CREATE UNIQUE INDEX "LeaveBalance_userId_leaveTypeId_key" ON "LeaveBalance"("userId", "leaveTypeId");
CREATE INDEX "LeaveBalance_tenantId_idx" ON "LeaveBalance"("tenantId");
CREATE INDEX "LeaveRequest_tenantId_status_idx" ON "LeaveRequest"("tenantId", "status");
CREATE INDEX "TravelRequest_tenantId_status_idx" ON "TravelRequest"("tenantId", "status");
CREATE INDEX "ExpenseClaim_tenantId_status_idx" ON "ExpenseClaim"("tenantId", "status");
CREATE UNIQUE INDEX "PayrollRun_tenantId_year_month_key" ON "PayrollRun"("tenantId", "year", "month");
CREATE UNIQUE INDEX "PayrollItem_runId_userId_key" ON "PayrollItem"("runId", "userId");
CREATE INDEX "PayrollItem_tenantId_idx" ON "PayrollItem"("tenantId");
CREATE UNIQUE INDEX "ApprovalWorkflow_tenantId_requestType_key" ON "ApprovalWorkflow"("tenantId", "requestType");
CREATE INDEX "AuditLog_tenantId_entityType_entityId_idx" ON "AuditLog"("tenantId", "entityType", "entityId");

-- AddForeignKey (within-tenant only, no cross-DB references)
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_leaveTypeId_fkey"
    FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey"
    FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TravelRequest" ADD CONSTRAINT "TravelRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_travelRequestId_fkey"
    FOREIGN KEY ("travelRequestId") REFERENCES "TravelRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExpenseClaim" ADD CONSTRAINT "ExpenseClaim_payrollItemId_fkey"
    FOREIGN KEY ("payrollItemId") REFERENCES "PayrollItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
