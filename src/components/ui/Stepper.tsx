import "./ui.css";

export type StepperStep = {
  id: string;
  label: string;
  meta?: string;
  state: "todo" | "current" | "done";
};

export type StepperProps = {
  steps: StepperStep[];
  ariaLabel?: string;
};

export function Stepper({ steps, ariaLabel = "Progress" }: StepperProps) {
  return (
    <ol className="ui-stepper" aria-label={ariaLabel}>
      {steps.map((step, index) => (
        <li key={step.id} className="ui-stepper__item" data-state={step.state}>
          <span className="ui-stepper__marker" aria-hidden="true">
            {step.state === "done" ? "✓" : index + 1}
          </span>
          <div>
            <div className="ui-stepper__label">{step.label}</div>
            {step.meta ? <div className="ui-stepper__meta">{step.meta}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
