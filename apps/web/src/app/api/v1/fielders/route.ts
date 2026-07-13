import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { fielderSchema } from "@uln/shared";
import { prisma, UserRole } from "@uln/database";
import { getRequestUser } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk, requireOfficeUser } from "@/lib/api";
import { serializeProject } from "@/lib/projects";
import { z } from "zod";

const createFielderSchema = fielderSchema.extend({
  loginEmail: z.string().email().optional(),
  loginPassword: z.string().min(6).optional(),
});

export async function GET(request: NextRequest) {
  try {
    requireOfficeUser(await getRequestUser(request));

    const fielders = await prisma.fielder.findMany({
      orderBy: { lastName: "asc" },
      include: { user: { select: { email: true } } },
    });

    return jsonOk(serializeProject(fielders));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireOfficeUser(await getRequestUser(request));

    const body = await request.json();
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

    return jsonOk(serializeProject(fielder), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
