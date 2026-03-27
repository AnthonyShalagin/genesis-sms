import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const logs = await prisma.commandLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      command: true,
      sender: true,
      status: true,
      response: true,
      error: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ logs });
}
