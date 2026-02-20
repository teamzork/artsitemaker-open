// packages/admin/src/pages/api/profile/change-password.ts
import type { APIRoute } from "astro";
import { getSession, SESSION_COOKIE_NAME, hashPassword, verifyPassword, getAuthConfig } from "../../../lib/auth";
import { isEmailAuthConfigured, updateUserPassword } from "../../../lib/db-auth";
import fs from "fs";
import yaml from "js-yaml";
import { getProjectConfigPath } from "../../../lib/config-paths";

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Current password and new password are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: "New password must be at least 8 characters long" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get current session
    const sessionCookie = cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const authConfig = getAuthConfig();

    // Handle email auth (database)
    if (authConfig.method === "email") {
      const emailConfigured = await isEmailAuthConfigured();
      if (!emailConfigured) {
        return new Response(
          JSON.stringify({ error: "Email authentication not configured" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // For email auth, we need to use the database
      const { validateSession } = await import("../../../lib/db-auth");
      const result = await validateSession(sessionCookie);
      
      if (!result.valid) {
        return new Response(
          JSON.stringify({ error: "Invalid session" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      // Update password in database
      const updated = await updateUserPassword(result.user.id, currentPassword, newPassword);
      
      if (!updated) {
        return new Response(
          JSON.stringify({ error: "Current password is incorrect" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Password updated successfully" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle basic auth (file-based)
    if (authConfig.method === "basic") {
      const session = getSession(cookies);
      if (!session) {
        return new Response(
          JSON.stringify({ error: "Invalid session" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      // Verify current password
      const storedHash = authConfig.basic?.passwordHash;
      if (!storedHash) {
        return new Response(
          JSON.stringify({ error: "No password configured" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const isValid = await verifyPassword(currentPassword, storedHash);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: "Current password is incorrect" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Hash new password
      const newHash = await hashPassword(newPassword);

      // Update config file
      const configPath = getProjectConfigPath();
      const content = fs.readFileSync(configPath, "utf-8");
      const config = yaml.load(content) as any;

      if (!config.auth) {
        config.auth = {};
      }
      if (!config.auth.basic) {
        config.auth.basic = {};
      }
      config.auth.basic.passwordHash = newHash;

      fs.writeFileSync(configPath, yaml.dump(config, { lineWidth: -1 }));

      // Invalidate auth config cache
      const { invalidateAuthConfigCache } = await import("../../../lib/auth");
      invalidateAuthConfigCache();

      return new Response(
        JSON.stringify({ success: true, message: "Password updated successfully" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // GitHub auth doesn't support password changes
    if (authConfig.method === "github") {
      return new Response(
        JSON.stringify({ error: "Password changes are not supported for GitHub authentication" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Authentication method not supported" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error changing password:", error);
    return new Response(
      JSON.stringify({ error: "Failed to change password" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
