"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Assign default role (author) to new users
  if (data.user) {
    const serviceClient = await createServiceClient();
    const { error: roleError } = await serviceClient.from("user_roles").insert({
      user_id: data.user.id,
      role: "author",
    });

    if (roleError) {
      console.error("Error assigning role:", roleError);
    }
  }

  revalidatePath("/", "layout");
  redirect("/");
}
