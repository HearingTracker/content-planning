import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { importFromTrello, previewImport } from "@/lib/trello";

/**
 * POST /api/trello/import
 *
 * Import cards from Trello Publishing board.
 * Requires admin role.
 *
 * Body:
 *   - dryRun: boolean (default: false) - Preview only, don't insert
 *   - skipExisting: boolean (default: true) - Skip cards already imported
 *   - listFilter: string[] (optional) - Only import from these list IDs
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userRole?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin role required" },
        { status: 403 }
      );
    }

    // Parse body
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun ?? false;
    const skipExisting = body.skipExisting ?? true;
    const listFilter = body.listFilter as string[] | undefined;

    // Run import
    const result = dryRun
      ? await previewImport({ skipExisting, listFilter })
      : await importFromTrello({ skipExisting, listFilter });

    return NextResponse.json({
      success: result.success,
      dryRun,
      summary: {
        totalCards: result.totalCards,
        imported: result.imported,
        skipped: result.skipped,
        errors: result.errors,
      },
      results: result.results,
    });
  } catch (error) {
    console.error("[Trello Import] Error:", error);
    return NextResponse.json(
      {
        error: "Import failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trello/import
 *
 * Preview import (dry run).
 * Requires admin role.
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (userRole?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin role required" },
        { status: 403 }
      );
    }

    // Run preview
    const result = await previewImport({ skipExisting: true });

    return NextResponse.json({
      success: true,
      dryRun: true,
      summary: {
        totalCards: result.totalCards,
        wouldImport: result.imported,
        wouldSkip: result.skipped,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error("[Trello Import] Error:", error);
    return NextResponse.json(
      {
        error: "Preview failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
