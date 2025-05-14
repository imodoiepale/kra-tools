import { automations, Automation, AutomationType } from "./useAutomations";

export function useAutomationsByType(type: AutomationType): Automation[] {
  return automations.filter(a => a.type === type);
}

export function useAutomationDetails(id: string | null): Automation | undefined {
  if (!id) return undefined;
  return automations.find(a => a.id === id);
}
