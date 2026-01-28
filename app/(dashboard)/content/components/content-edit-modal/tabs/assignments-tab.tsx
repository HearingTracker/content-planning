"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { User, ContentAssignment, AssignmentRole, AssignmentInput } from "../../types";
import { updateAssignments } from "../../../actions";

interface AssignmentsTabProps {
  contentItemId: number | null;
  assignments: ContentAssignment[];
  users: User[];
  onAssignmentsChange: (assignments: ContentAssignment[]) => void;
}

const ROLES: { value: AssignmentRole; label: string }[] = [
  { value: "author", label: "Author" },
  { value: "editor", label: "Editor" },
  { value: "reviewer", label: "Reviewer" },
  { value: "contributor", label: "Contributor" },
];

export function AssignmentsTab({
  contentItemId,
  assignments,
  users,
  onAssignmentsChange,
}: AssignmentsTabProps) {
  const [newUserId, setNewUserId] = useState<string>("");
  const [newRole, setNewRole] = useState<AssignmentRole>("author");
  const [isSaving, setIsSaving] = useState(false);

  const handleAddAssignment = async () => {
    if (!newUserId || !contentItemId) return;

    // Check if this user+role combo already exists
    const exists = assignments.some(
      (a) => a.user_id === newUserId && a.role === newRole
    );
    if (exists) return;

    const user = users.find((u) => u.id === newUserId);
    if (!user) return;

    const newAssignment: ContentAssignment = {
      id: Date.now(), // Temporary ID
      content_id: contentItemId,
      user_id: newUserId,
      user,
      role: newRole,
      assigned_at: new Date().toISOString(),
      notes: null,
    };

    const newAssignments = [...assignments, newAssignment];

    // Save to server
    setIsSaving(true);
    const inputs: AssignmentInput[] = newAssignments.map((a) => ({
      user_id: a.user_id,
      role: a.role,
    }));

    const result = await updateAssignments(contentItemId, inputs);
    setIsSaving(false);

    if (result.success) {
      onAssignmentsChange(newAssignments);
      setNewUserId("");
    }
  };

  const handleRemoveAssignment = async (assignmentToRemove: ContentAssignment) => {
    if (!contentItemId) return;

    const newAssignments = assignments.filter(
      (a) => !(a.user_id === assignmentToRemove.user_id && a.role === assignmentToRemove.role)
    );

    // Save to server
    setIsSaving(true);
    const inputs: AssignmentInput[] = newAssignments.map((a) => ({
      user_id: a.user_id,
      role: a.role,
    }));

    const result = await updateAssignments(contentItemId, inputs);
    setIsSaving(false);

    if (result.success) {
      onAssignmentsChange(newAssignments);
    }
  };

  const getRoleColor = (role: AssignmentRole) => {
    switch (role) {
      case "author":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "editor":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "reviewer":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
      case "contributor":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  // Group assignments by role
  const assignmentsByRole = ROLES.map((role) => ({
    role,
    assignments: assignments.filter((a) => a.role === role.value),
  })).filter((group) => group.assignments.length > 0);

  if (!contentItemId) {
    return (
      <div className="space-y-4 p-1">
        <p className="text-sm text-muted-foreground">
          Save the content item first to manage assignments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {/* Current assignments grouped by role */}
      <div className="space-y-4">
        <Label>Current Assignments</Label>
        {assignmentsByRole.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assignments yet</p>
        ) : (
          <div className="space-y-3">
            {assignmentsByRole.map((group) => (
              <div key={group.role.value} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {group.role.label}s
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.assignments.map((assignment) => (
                    <Badge
                      key={`${assignment.user_id}-${assignment.role}`}
                      variant="secondary"
                      className={`${getRoleColor(assignment.role)} flex items-center gap-1 pr-1`}
                    >
                      <span>{assignment.user.display_name || assignment.user.email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAssignment(assignment)}
                        disabled={isSaving}
                        className="ml-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add new assignment */}
      <div className="space-y-2">
        <Label>Add Assignment</Label>
        <div className="flex gap-2">
          <Select value={newUserId} onValueChange={setNewUserId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.display_name || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={newRole}
            onValueChange={(v) => setNewRole(v as AssignmentRole)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAddAssignment}
            disabled={!newUserId || isSaving}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Assign team members to work on this content.
        </p>
      </div>
    </div>
  );
}
