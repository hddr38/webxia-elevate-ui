import { Skill, SkillRegistry, ToolDefinition, ToolPermission } from "./types";
import { SkillErrorCode } from "./types";

export class InMemorySkillRegistry implements SkillRegistry {
  private skills = new Map<string, Skill>();

  register(skill: Skill): void {
    if (this.skills.has(skill.name)) {
      throw new Error(`Skill with name "${skill.name}" already registered`);
    }
    this.skills.set(skill.name, skill);
  }

  unregister(name: string): void {
    this.skills.delete(name);
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  has(name: string): boolean {
    return this.skills.has(name);
  }

  getToolDefinitions(): ToolDefinition[] {
    return this.getAll().map((skill) => skill.toToolDefinition());
  }

  getByPermission(permission: ToolPermission): Skill[] {
    return this.getAll().filter((skill) => skill.permissions.includes(permission));
  }

  clear(): void {
    this.skills.clear();
  }

  size(): number {
    return this.skills.size;
  }
}

export const skillRegistry = new InMemorySkillRegistry();

export function registerSkill(skill: Skill): void {
  skillRegistry.register(skill);
}

export function unregisterSkill(name: string): void {
  skillRegistry.unregister(name);
}

export function getSkill(name: string): Skill | undefined {
  return skillRegistry.get(name);
}

export function listSkills(): Skill[] {
  return skillRegistry.getAll();
}

export function hasSkill(name: string): boolean {
  return skillRegistry.has(name);
}

export function getAllToolDefinitions(): ToolDefinition[] {
  return skillRegistry.getToolDefinitions();
}

export function getSkillsByPermission(permission: ToolPermission): Skill[] {
  return skillRegistry.getByPermission(permission);
}
