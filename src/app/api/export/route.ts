import { NextRequest } from "next/server";
import type { PersonaResult } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const { personas }: { personas: PersonaResult[] } = await request.json();

    if (!personas || personas.length === 0) {
      return Response.json({ error: "No data to export" }, { status: 400 });
    }

    const headers = [
      "Persona ID",
      "Age",
      "Gender",
      "Income",
      "Region",
      "Ethnicity",
      "Mean PI",
      "P(Score=1)",
      "P(Score=2)",
      "P(Score=3)",
      "P(Score=4)",
      "P(Score=5)",
      "Raw Response",
    ];

    const rows = personas.map((p) => [
      p.personaId,
      p.demographics.age,
      p.demographics.gender,
      p.demographics.income,
      p.demographics.region,
      p.demographics.ethnicity,
      p.meanPI,
      ...p.likertDistribution.map((v) => v.toFixed(4)),
      `"${p.rawResponse.replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition":
          'attachment; filename="synthpanel-export.csv"',
      },
    });
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
