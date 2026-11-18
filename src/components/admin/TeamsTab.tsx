"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  RefreshCw,
  AlertCircle,
  X,
  UserPlus,
  Crown,
  ChevronRight,
  Activity,
  UserX,
} from "lucide-react";
import type { AdminController } from "@/components/admin/shared";
import { ConsoleHero, Panel, Pill, AdminButton, TextInput, TextArea, Field } from "@/components/admin/ui";
import { api } from "@/lib/client";
import type { Team, TeamPermission, TeamStatus } from "@/lib/domain";
import { dateLabel } from "@/lib/domain";

const AVAILABLE_PERMISSIONS: { key: TeamPermission; label: string; description: string }[] = [
  {
    key: "MANAGE_MEMBERS",
    label: "Manage Team Members",
    description: "Allow team leader to add or remove members in their team",
  },
  {
    key: "VIEW_TEAM_ORDERS",
    label: "View Team Orders",
    description: "View purchases, status, and tracking for orders placed by team members",
  },
  {
    key: "VIEW_TEAM_METRICS",
    label: "View Team Metrics",
    description: "Access team volume, conversion metrics, and referral statistics",
  },
  {
    key: "MANAGE_TEAM_LEADS",
    label: "Manage Team Leads",
    description: "Assign and follow up on incoming referral leads within the team",
  },
  {
    key: "APPROVE_WITHDRAWALS_PREVIEW",
    label: "Review Member Payouts",
    description: "Preview and endorse member payout requests before final admin clearance",
  },
];

export function TeamsTab({ ctl }: { ctl: AdminController }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createLeaderId, setCreateLeaderId] = useState("");
  const [createStatus, setCreateStatus] = useState<TeamStatus>("ACTIVE");
  const [createPerms, setCreatePerms] = useState<TeamPermission[]>([
    "MANAGE_MEMBERS",
    "VIEW_TEAM_ORDERS",
    "VIEW_TEAM_METRICS",
  ]);
  const [createMemberIds, setCreateMemberIds] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  // Edit Modal State
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editLeaderId, setEditLeaderId] = useState("");
  const [editStatus, setEditStatus] = useState<TeamStatus>("ACTIVE");
  const [editPerms, setEditPerms] = useState<TeamPermission[]>([]);
  const [editMemberIds, setEditMemberIds] = useState<string[]>([]);
  const [editMemberSearchQuery, setEditMemberSearchQuery] = useState("");

  // Delete Confirmation Modal State
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const data = await api.admin.teams.list();
      setTeams(data || []);
    } catch (err: any) {
      ctl.notify("error", err?.message || "Failed to load teams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTeams();
  }, []);

  const allCustomers = useMemo(() => ctl.snapshot?.customers ?? [], [ctl.snapshot?.customers]);

  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      const matchSearch =
        !search.trim() ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.leaderName.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === "ALL" || t.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [teams, search, statusFilter]);

  const stats = useMemo(() => {
    const total = teams.length;
    const active = teams.filter((t) => t.status === "ACTIVE").length;
    const totalMembers = teams.reduce((acc, t) => acc + (t.members?.length || 0), 0);
    const leaders = new Set(teams.map((t) => t.leaderId)).size;
    return { total, active, totalMembers, leaders };
  }, [teams]);

  const handleOpenCreate = () => {
    setCreateName("");
    setCreateDesc("");
    setCreateLeaderId(allCustomers[0]?.id || "");
    setCreateStatus("ACTIVE");
    setCreatePerms(["MANAGE_MEMBERS", "VIEW_TEAM_ORDERS", "VIEW_TEAM_METRICS"]);
    setCreateMemberIds([]);
    setMemberSearchQuery("");
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      ctl.notify("error", "Team name is required");
      return;
    }
    if (!createLeaderId) {
      ctl.notify("error", "Please select a team leader");
      return;
    }

    try {
      setSubmitting(true);
      const newTeam = await api.admin.teams.create({
        name: createName.trim(),
        description: createDesc.trim(),
        leaderId: createLeaderId,
        status: createStatus,
        permissions: createPerms,
        memberIds: createMemberIds,
      });
      ctl.notify("success", `Team "${newTeam.name}" created successfully`);
      setIsCreateOpen(false);
      void fetchTeams();
    } catch (err: any) {
      ctl.notify("error", err?.message || "Failed to create team");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (team: Team) => {
    setEditingTeam(team);
    setEditName(team.name);
    setEditDesc(team.description);
    setEditLeaderId(team.leaderId);
    setEditStatus(team.status);
    setEditPerms(team.permissions || []);
    setEditMemberIds(team.members?.map((m) => m.customerId) || []);
    setEditMemberSearchQuery("");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    if (!editName.trim()) {
      ctl.notify("error", "Team name is required");
      return;
    }
    if (!editLeaderId) {
      ctl.notify("error", "Team leader is required");
      return;
    }

    try {
      setSubmitting(true);
      const updated = await api.admin.teams.update(editingTeam.id, {
        name: editName.trim(),
        description: editDesc.trim(),
        leaderId: editLeaderId,
        status: editStatus,
        permissions: editPerms,
        memberIds: editMemberIds,
      });
      ctl.notify("success", `Team "${updated.name}" updated successfully`);
      setEditingTeam(null);
      void fetchTeams();
    } catch (err: any) {
      ctl.notify("error", err?.message || "Failed to update team");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (team: Team) => {
    const nextStatus: TeamStatus = team.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await api.admin.teams.update(team.id, { status: nextStatus });
      ctl.notify("success", `Team "${team.name}" is now ${nextStatus}`);
      void fetchTeams();
    } catch (err: any) {
      ctl.notify("error", err?.message || "Failed to toggle team status");
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deletingTeam) return;
    try {
      setSubmitting(true);
      await api.admin.teams.delete(deletingTeam.id);
      ctl.notify("success", `Team "${deletingTeam.name}" deleted successfully`);
      setDeletingTeam(null);
      void fetchTeams();
    } catch (err: any) {
      ctl.notify("error", err?.message || "Failed to delete team");
    } finally {
      setSubmitting(false);
    }
  };

  const togglePermission = (
    perm: TeamPermission,
    current: TeamPermission[],
    setter: React.Dispatch<React.SetStateAction<TeamPermission[]>>
  ) => {
    if (current.includes(perm)) {
      setter(current.filter((p) => p !== perm));
    } else {
      setter([...current, perm]);
    }
  };

  const toggleMemberSelection = (
    customerId: string,
    current: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (current.includes(customerId)) {
      setter(current.filter((id) => id !== customerId));
    } else {
      setter([...current, customerId]);
    }
  };

  return (
    <div className="space-y-6">
      <ConsoleHero
        eyebrow="Admin Management"
        title="Team Creation & Management"
        subtitle="Organize community leaders, affiliate groups, and regional operational teams. Configure permissions, track member performance, and delegate responsibilities."
        actions={
          <div className="flex items-center gap-3">
            <AdminButton variant="outline" icon={RefreshCw} onClick={() => void fetchTeams()} pending={loading}>
              Refresh
            </AdminButton>
            <AdminButton variant="primary" icon={Plus} onClick={handleOpenCreate}>
              Create Team
            </AdminButton>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Panel className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">Total Teams</p>
          <p className="mt-1 text-2xl font-black text-[var(--adm-text)]">{stats.total}</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">Active Teams</p>
          <p className="mt-1 text-2xl font-black text-[var(--adm-accent)]">{stats.active}</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">Total Members</p>
          <p className="mt-1 text-2xl font-black text-[var(--adm-text)]">{stats.totalMembers}</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">Team Leaders</p>
          <p className="mt-1 text-2xl font-black text-[var(--adm-warning)]">{stats.leaders}</p>
        </Panel>
      </div>

      {/* Filter and Search Bar */}
      <Panel className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--adm-text-muted)]" />
            <input
              type="text"
              placeholder="Search by team name, leader, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-[var(--adm-text)]/8 bg-[var(--adm-bg-deep)] pl-9 pr-3 text-xs text-[var(--adm-text)] placeholder-[var(--adm-text-muted)] focus:border-[var(--adm-accent)] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            {(["ALL", "ACTIVE", "INACTIVE"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  statusFilter === filter
                    ? "bg-[var(--adm-accent)] text-[var(--adm-on-accent)]"
                    : "border border-[var(--adm-text)]/8 bg-[var(--adm-bg-deep)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      {/* Teams Grid / List */}
      {loading ? (
        <Panel className="flex h-64 items-center justify-center p-8 text-center text-sm text-[var(--adm-text-muted)]">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin text-[var(--adm-accent)]" />
          Loading team roster...
        </Panel>
      ) : filteredTeams.length === 0 ? (
        <Panel className="p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-[var(--adm-text-muted)]" />
          <p className="mt-4 text-sm font-semibold text-[var(--adm-text)]">No teams found</p>
          <p className="mt-1 text-xs text-[var(--adm-text-muted)]">
            {search || statusFilter !== "ALL"
              ? "No teams match your search or filter criteria."
              : "Get started by creating your first organizational team."}
          </p>
          {!(search || statusFilter !== "ALL") && (
            <AdminButton variant="primary" icon={Plus} onClick={handleOpenCreate} className="mt-4 inline-flex">
              Create Team
            </AdminButton>
          )}
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredTeams.map((team) => (
            <Panel key={team.id} className="relative flex flex-col justify-between p-5 transition-all hover:border-[var(--adm-border)]">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-[var(--adm-text)]">{team.name}</h3>
                      <Pill tone={team.status === "ACTIVE" ? "green" : "neutral"}>
                        {team.status}
                      </Pill>
                    </div>
                    {team.description ? (
                      <p className="mt-1 text-xs text-[var(--adm-text-muted)] line-clamp-2">{team.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      title={team.status === "ACTIVE" ? "Deactivate Team" : "Activate Team"}
                      onClick={() => void handleToggleStatus(team)}
                      className="rounded p-1.5 text-[var(--adm-text-muted)] transition-colors hover:bg-[var(--adm-surface)]/6 hover:text-[var(--adm-text)]"
                    >
                      {team.status === "ACTIVE" ? (
                        <CheckCircle2 className="h-4 w-4 text-[var(--adm-accent)]" />
                      ) : (
                        <XCircle className="h-4 w-4 text-[var(--adm-warning)]" />
                      )}
                    </button>
                    <button
                      type="button"
                      title="Edit Team"
                      onClick={() => handleOpenEdit(team)}
                      className="rounded p-1.5 text-[var(--adm-text-muted)] transition-colors hover:bg-[var(--adm-surface)]/6 hover:text-[var(--adm-text)]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Delete Team"
                      onClick={() => setDeletingTeam(team)}
                      className="rounded p-1.5 text-[var(--adm-text-muted)] transition-colors hover:bg-[var(--adm-danger)]/10 hover:text-[var(--adm-danger)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Leader and Member Counts */}
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-[var(--adm-text)]/4 bg-[var(--adm-bg-deep)] p-3 text-xs">
                  <div>
                    <div className="flex items-center gap-1.5 text-[var(--adm-text-muted)]">
                      <Crown className="h-3.5 w-3.5 text-[var(--adm-warning)]" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Team Leader</span>
                    </div>
                    <p className="mt-1 font-semibold text-[var(--adm-text)] truncate">{team.leaderName}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-[var(--adm-text-muted)]">
                      <Users className="h-3.5 w-3.5 text-[var(--adm-accent)]" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Members</span>
                    </div>
                    <p className="mt-1 font-semibold text-[var(--adm-text)]">
                      {team.members?.length || 0} {team.members?.length === 1 ? "member" : "members"}
                    </p>
                  </div>
                </div>

                {/* Permissions Badges */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-1.5">
                    Assigned Permissions
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {team.permissions && team.permissions.length > 0 ? (
                      team.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="inline-flex items-center gap-1 rounded bg-[var(--adm-surface)]/4 px-2 py-0.5 text-[10px] font-medium text-[var(--adm-text)] border border-[var(--adm-text)]/6"
                        >
                          <ShieldCheck className="h-3 w-3 text-[var(--adm-accent)]" />
                          {AVAILABLE_PERMISSIONS.find((p) => p.key === perm)?.label || perm}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-[var(--adm-text-muted)]">No special permissions granted</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer info */}
              <div className="mt-4 flex items-center justify-between border-t border-[var(--adm-text)]/6 pt-3 text-[10px] text-[var(--adm-text-muted)]">
                <span>Created: {dateLabel(team.createdAt)}</span>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(team)}
                  className="inline-flex items-center gap-1 font-semibold text-[var(--adm-accent)] hover:underline"
                >
                  Manage Roster <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {/* CREATE TEAM MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[var(--adm-text)]/12 bg-[var(--adm-surface-2)] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--adm-text)]/8 pb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[var(--adm-accent)]" />
                <h2 className="text-base font-bold text-[var(--adm-text)]">Create New Team</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="rounded p-1 text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-5 space-y-5">
              <Field label="Team Name *" hint="Distinct name for this team or chapter">
                <TextInput
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Bangalore Street Squad / Elite Affiliates"
                  required
                />
              </Field>

              <Field label="Description" hint="Optional mission or territory notes">
                <TextArea
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  placeholder="Purpose, responsibilities, or target region..."
                  rows={2}
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Team Leader *" hint="Primary leader accountable for the team">
                  <select
                    value={createLeaderId}
                    onChange={(e) => setCreateLeaderId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[var(--adm-text)]/8 bg-[var(--adm-bg-deep)] px-3 text-xs text-[var(--adm-text)] focus:border-[var(--adm-accent)] focus:outline-none"
                    required
                  >
                    <option value="" disabled>
                      Select a customer as leader
                    </option>
                    {allCustomers.map((cust) => (
                      <option key={cust.id} value={cust.id}>
                        {cust.name || "Customer"} · {cust.phone || cust.email || cust.id}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Team Status" hint="Operational status">
                  <select
                    value={createStatus}
                    onChange={(e) => setCreateStatus(e.target.value as TeamStatus)}
                    className="h-10 w-full rounded-lg border border-[var(--adm-text)]/8 bg-[var(--adm-bg-deep)] px-3 text-xs text-[var(--adm-text)] focus:border-[var(--adm-accent)] focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE (Operational)</option>
                    <option value="INACTIVE">INACTIVE (Suspended)</option>
                  </select>
                </Field>
              </div>

              {/* Permissions Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-2">
                  Leader & Team Permissions
                </label>
                <div className="space-y-2 rounded-lg border border-[var(--adm-text)]/8 bg-[var(--adm-bg-deep)] p-3">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const checked = createPerms.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className="flex cursor-pointer items-start gap-2.5 rounded p-1.5 transition-colors hover:bg-[var(--adm-surface)]/4"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(perm.key, createPerms, setCreatePerms)}
                          className="mt-0.5 rounded border-[var(--adm-text)]/20 bg-black text-[var(--adm-accent)] focus:ring-0"
                        />
                        <div>
                          <p className="text-xs font-semibold text-[var(--adm-text)]">{perm.label}</p>
                          <p className="text-[10px] text-[var(--adm-text-muted)]">{perm.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Members Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">
                    Initial Members ({createMemberIds.length} selected)
                  </label>
                  <span className="text-[10px] text-[var(--adm-text-muted)]">Leader is automatically included</span>
                </div>

                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--adm-text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search customers to add..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    className="h-8 w-full rounded border border-[var(--adm-text)]/8 bg-[var(--adm-bg-deep)] pl-8 pr-3 text-xs text-[var(--adm-text)] placeholder-[var(--adm-text-muted)] focus:border-[var(--adm-accent)] focus:outline-none"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-[var(--adm-text)]/8 bg-[var(--adm-bg-deep)] p-2">
                  {allCustomers
                    .filter((c) => {
                      if (!memberSearchQuery.trim()) return true;
                      const q = memberSearchQuery.toLowerCase();
                      return (
                        c.name?.toLowerCase().includes(q) ||
                        c.phone?.includes(q) ||
                        c.email?.toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 50)
                    .map((cust) => {
                      const isLeader = cust.id === createLeaderId;
                      const isSelected = isLeader || createMemberIds.includes(cust.id);
                      return (
                        <div
                          key={cust.id}
                          onClick={() => {
                            if (!isLeader) toggleMemberSelection(cust.id, createMemberIds, setCreateMemberIds);
                          }}
                          className={`flex items-center justify-between rounded px-2.5 py-1.5 text-xs transition-colors ${
                            isLeader
                              ? "bg-[var(--adm-warning)]/10 text-[var(--adm-warning)] cursor-default"
                              : isSelected
                              ? "bg-[var(--adm-accent)]/10 text-[var(--adm-text)] cursor-pointer"
                              : "text-[var(--adm-text-muted)] hover:bg-[var(--adm-surface)]/4 hover:text-[var(--adm-text)] cursor-pointer"
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="font-semibold">{cust.name || "Customer"}</span>
                            <span className="ml-2 text-[10px] text-[var(--adm-text-muted)]">
                              {cust.phone || cust.email || cust.id}
                            </span>
                          </div>
                          {isLeader ? (
                            <span className="text-[10px] font-bold text-[var(--adm-warning)]">LEADER</span>
                          ) : isSelected ? (
                            <span className="text-[10px] font-bold text-[var(--adm-accent)]">ADDED</span>
                          ) : (
                            <span className="text-[10px] text-[var(--adm-text)]">+ ADD</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-[var(--adm-text)]/8 pt-4">
                <AdminButton variant="outline" type="button" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </AdminButton>
                <AdminButton variant="primary" type="submit" pending={submitting}>
                  Create Team
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TEAM MODAL */}
      {editingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[var(--adm-text)]/12 bg-[var(--adm-surface-2)] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--adm-text)]/8 pb-4">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-[var(--adm-accent)]" />
                <h2 className="text-base font-bold text-[var(--adm-text)]">Edit Team: {editingTeam.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingTeam(null)}
                className="rounded p-1 text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-5 space-y-5">
              <Field label="Team Name *" hint="Distinct name for this team">
                <TextInput
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Team Name"
                  required
                />
              </Field>

              <Field label="Description" hint="Team notes or responsibilities">
                <TextArea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Team description..."
                  rows={2}
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Team Leader *" hint="Assigned leader">
                  <select
                    value={editLeaderId}
                    onChange={(e) => setEditLeaderId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[var(--adm-text)]/8 bg-[var(--adm-bg-deep)] px-3 text-xs text-[var(--adm-text)] focus:border-[var(--adm-accent)] focus:outline-none"
                    required
                  >
                    {allCustomers.map((cust) => (
                      <option key={cust.id} value={cust.id}>
                        {cust.name || "Customer"} · {cust.phone || cust.email || cust.id}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Team Status" hint="Operational status">
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as TeamStatus)}
                    className="h-10 w-full rounded-lg border border-[var(--adm-text)]/8 bg-[var(--adm-bg-deep)] px-3 text-xs text-[var(--adm-text)] focus:border-[var(--adm-accent)] focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE (Operational)</option>
                    <option value="INACTIVE">INACTIVE (Suspended)</option>
                  </select>
                </Field>
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-2">
                  Permissions
                </label>
                <div className="space-y-2 rounded-lg border border-[var(--adm-text)]/8 bg-[var(--adm-bg-deep)] p-3">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const checked = editPerms.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className="flex cursor-pointer items-start gap-2.5 rounded p-1.5 transition-colors hover:bg-[var(--adm-surface)]/4"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(perm.key, editPerms, setEditPerms)}
                          className="mt-0.5 rounded border-[var(--adm-text)]/20 bg-black text-[var(--adm-accent)] focus:ring-0"
                        />
                        <div>
                          <p className="text-xs font-semibold text-[var(--adm-text)]">{perm.label}</p>
                          <p className="text-[10px] text-[var(--adm-text-muted)]">{perm.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Members Management */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">
                    Team Members ({editMemberIds.length} members)
                  </label>
                </div>

                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--adm-text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search customers to add or remove..."
                    value={editMemberSearchQuery}
                    onChange={(e) => setEditMemberSearchQuery(e.target.value)}
                    className="h-8 w-full rounded border border-[var(--adm-text)]/8 bg-[var(--adm-bg-deep)] pl-8 pr-3 text-xs text-[var(--adm-text)] placeholder-[var(--adm-text-muted)] focus:border-[var(--adm-accent)] focus:outline-none"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-[var(--adm-text)]/8 bg-[var(--adm-bg-deep)] p-2">
                  {allCustomers
                    .filter((c) => {
                      if (!editMemberSearchQuery.trim()) return true;
                      const q = editMemberSearchQuery.toLowerCase();
                      return (
                        c.name?.toLowerCase().includes(q) ||
                        c.phone?.includes(q) ||
                        c.email?.toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 50)
                    .map((cust) => {
                      const isLeader = cust.id === editLeaderId;
                      const isSelected = isLeader || editMemberIds.includes(cust.id);
                      return (
                        <div
                          key={cust.id}
                          onClick={() => {
                            if (!isLeader) toggleMemberSelection(cust.id, editMemberIds, setEditMemberIds);
                          }}
                          className={`flex items-center justify-between rounded px-2.5 py-1.5 text-xs transition-colors ${
                            isLeader
                              ? "bg-[var(--adm-warning)]/10 text-[var(--adm-warning)] cursor-default"
                              : isSelected
                              ? "bg-[var(--adm-accent)]/10 text-[var(--adm-text)] cursor-pointer"
                              : "text-[var(--adm-text-muted)] hover:bg-[var(--adm-surface)]/4 hover:text-[var(--adm-text)] cursor-pointer"
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="font-semibold">{cust.name || "Customer"}</span>
                            <span className="ml-2 text-[10px] text-[var(--adm-text-muted)]">
                              {cust.phone || cust.email || cust.id}
                            </span>
                          </div>
                          {isLeader ? (
                            <span className="text-[10px] font-bold text-[var(--adm-warning)]">LEADER</span>
                          ) : isSelected ? (
                            <span className="text-[10px] font-bold text-[var(--adm-danger)] hover:underline">REMOVE</span>
                          ) : (
                            <span className="text-[10px] text-[var(--adm-accent)]">+ ADD</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-[var(--adm-text)]/8 pt-4">
                <AdminButton variant="outline" type="button" onClick={() => setEditingTeam(null)}>
                  Cancel
                </AdminButton>
                <AdminButton variant="primary" type="submit" pending={submitting}>
                  Save Changes
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-xl border border-[var(--adm-danger)]/30 bg-[var(--adm-surface-2)] p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-[var(--adm-danger)]">
              <AlertCircle className="h-6 w-6" />
              <h2 className="text-base font-bold text-[var(--adm-text)]">Delete Team</h2>
            </div>
            <p className="mt-3 text-xs text-[var(--adm-text-muted)] leading-relaxed">
              Are you sure you want to delete team <strong className="text-[var(--adm-text)]">{deletingTeam.name}</strong>?
              This action cannot be undone. Team members will remain intact as individual customers.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <AdminButton variant="outline" type="button" onClick={() => setDeletingTeam(null)}>
                Cancel
              </AdminButton>
              <AdminButton
                variant="danger"
                type="button"
                onClick={handleDeleteSubmit}
                pending={submitting}
              >
                Delete Team
              </AdminButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

