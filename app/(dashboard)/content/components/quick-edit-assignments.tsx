"use client";

import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ContentItem, User, AssignmentRole, AssignmentInput } from "./types";
import { updateAssignments } from "../actions";

interface QuickEditAssignmentsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ContentItem;
  users: User[];
  onSuccess?: () => void;
}

const ROLES: { value: AssignmentRole; label: string }[] = [
  { value: "author", label: "Author" },
  { value: "editor", label: "Editor" },
  { value: "reviewer", label: "Reviewer" },
  { value: "contributor", label: "Contributor" },
];

export function QuickEditAssignments({
  open,
  onOpenChange,
  item,
  users,
  onSuccess,
}: QuickEditAssignmentsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentInput[]>([]);
  const [newUserId, setNewUserId] = useState<string>("");
  const [newRole, setNewRole] = useState<AssignmentRole>("author");

  // Reset assignments when item changes or dialog opens
  useEffect(() => {
    if (open) {
      setAssignments(
        item.assignments.map((a) => ({ user_id: a.user_id, role: a.role }))
      );
      setNewUserId("");
      setNewRole("author");
    }
  }, [item.id, open]);

  const handleAddAssignment = () => {
    if (!newUserId) return;
    // Check if this user+role combo already exists
    const exists = assignments.some(
      (a) => a.user_id === newUserId && a.role === newRole
    );
    if (exists) return;

    setAssignments([...assignments, { user_id: newUserId, role: newRole }]);
    setNewUserId("");
  };

  const handleRemoveAssignment = (index: number) => {
    setAssignments(assignments.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await updateAssignments(item.id, assignments);

      if (result.success) {
        onSuccess?.();
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user?.display_name || user?.email || userId;
  };

  const getRoleColor = (role: AssignmentRole) => {
    switch (role) {
      case "author":
        return "bg-blue-100 text-blue-800";
      case "editor":
        return "bg-purple-100 text-purple-800";
      case "reviewer":
        return "bg-amber-100 text-amber-800";
      case "contributor":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Assignments</DialogTitle>
            <DialogDescription>
              Manage team assignments for "{item.title}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current assignments */}
            <div className="space-y-2">
              <Label>Current Assignments</Label>
              {assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assignments yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {assignments.map((assignment, index) => (
                    <Badge
                      key={`${assignment.user_id}-${assignment.role}`}
                      variant="secondary"
                      className={`${getRoleColor(assignment.role)} flex items-center gap-1`}
                    >
                      <span>{getUserName(assignment.user_id)}</span>
                      <span className="text-xs opacity-75">({assignment.role})</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAssignment(index)}
                        className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
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
                  disabled={!newUserId}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
