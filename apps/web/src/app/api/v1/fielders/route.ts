import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import {
  DEFAULT_FIELDER_SQFT_RATE,
  canViewProjectFinancials,
  fielderSchema,
  passwordSchema,
} from "@uln/shared";
import { prisma, UserRole } from "@uln/database";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser } from "@/lib/api";
import { serializeProject, stripProjectMoney } from "@/lib/projects";
import { z } from "zod";

const createFielderSchema = fielderSchema.extend({
  loginEmail: z.string().email().optional(),
  loginPassword: passwordSchema.optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = requireOfficeUser(await getRequestUser(request));

    const fielders = await prisma.fielder.findMany({
      where: { isActive: true },
      orderBy: { lastName: "asc" },
      include: { user: { select: { email: true } } },
    });

    const serialized = serializeProject(fielders);
    return jsonOk(canViewProjectFinancials(user.role) ? serialized : stripProjectMoney(serialized));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireOfficeUser(await getRequestUser(request));
    const canSeeMoney = canViewProjectFinancials(user.role);

    const body = await request.json();
    if (!canSeeMoney && body && typeof body === "object") {
      body.defaultSqftRate = DEFAULT_FIELDER_SQFT_RATE;
    }
    const parsed = createFielderSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid input", 400);
    }

    const { loginEmail, loginPassword, ...fielderData } = parsed.data;

    if (loginEmail) {
      const existing = await prisma.user.findUnique({ where: { email: loginEmail.toLowerCase() } });
      if (existing) return jsonError("Login email already in use", 400);
    }

    const fielder = await prisma.fielder.create({
      data: {
        firstName: fielderData.firstName,
        lastName: fielderData.lastName,
        phone: fielderData.phone,
        email: fielderData.email || loginEmail || null,
        employmentType: fielderData.employmentType,
        defaultSqftRate: fielderData.defaultSqftRate,
        region: fielderData.region,
        skills: fielderData.skills ?? [],
        certifications: fielderData.certifications ?? [],
      },
    });

    if (loginEmail && loginPassword) {
      const passwordHash = await bcrypt.hash(loginPassword, 12);
      await prisma.user.create({
        data: {
          email: loginEmail.toLowerCase(),
          passwordHash,
          role: UserRole.fielder,
          fielderId: fielder.id,
        },
      });
    }

    const serialized = serializeProject(fielder);
    return jsonOk(canSeeMoney ? serialized : stripProjectMoney(serialized), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
