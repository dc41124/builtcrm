// Type shim for frappe-gantt. The upstream package ships no typings,
// and DefinitelyTyped's @types/frappe-gantt covers an older API.
// We use a narrow surface (tasks in, refresh + change_view_mode +
// event callbacks out), wrapped by src/components/gantt/FrappeGantt.tsx,
// so a minimal default-export declaration is sufficient for the
// compiler to trust our wrapper.
declare module "frappe-gantt" {
  export default class Gantt {
    constructor(
      wrapper: HTMLElement | SVGElement | string,
      tasks: Array<Record<string, unknown>>,
      options?: Record<string, unknown>,
    );
    refresh(tasks: Array<Record<string, unknown>>): void;
    change_view_mode(mode: string): void;
  }
}
