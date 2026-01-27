"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Target, Lightbulb, FileText } from "lucide-react";
import type { StrategyTab } from "./types";

interface StrategyTabsProps {
  activeTab: StrategyTab;
  onTabChange: (tab: StrategyTab) => void;
  counts: {
    campaigns: number;
    ideas: number;
    briefs: number;
  };
}

export function StrategyTabs({ activeTab, onTabChange, counts }: StrategyTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as StrategyTab)}>
      <TabsList>
        <TabsTrigger value="campaigns" className="gap-2">
          <Target className="h-4 w-4" />
          Campaigns
          {counts.campaigns > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {counts.campaigns}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="ideas" className="gap-2">
          <Lightbulb className="h-4 w-4" />
          Pitches
          {counts.ideas > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {counts.ideas}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="briefs" className="gap-2">
          <FileText className="h-4 w-4" />
          Briefs
          {counts.briefs > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
              {counts.briefs}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
