/**
 * ================================================================
 * DYNAMIC FORM - SINGLE COMPONENT
 * ================================================================
 * 
 * Complete form system in one file with Context provider
 * - React Hook Form + Zod validation
 * - All field types inline
 * - All layouts inline
 * 
 * Usage:
 * import { DynamicForm } from './DynamicForm';
 * import { myFormSchema } from './Schema';
 * 
 * <DynamicForm schema={myFormSchema} onSubmit={handleSubmit} />
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

type FieldRenderer = 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'date' | 'checkbox' | 'radio' | 'switch' | 'file';
type VisibilityOperator = 'equals' | 'in' | 'notEquals';
type LayoutKind = 'section' | 'grid' | 'stack' | 'field';

interface VisibilityCondition {
  field: string;
  op: VisibilityOperator;
  value: any;
}

interface ValidationRules {
  required?: string | boolean;
  minLength?: { value: number; message: string };
  maxLength?: { value: number; message: string };
  min?: { value: number; message: string };
  max?: { value: number; message: string };
  pattern?: { value: RegExp; message: string };
  validate?: (value: any, formValues: Record<string, any>) => boolean | string;
}

interface FieldDefinition {
  id: string;
  label: string;
  renderer: FieldRenderer;
  inputType?: string;
  placeholder?: string;
  defaultValue?: any;
  props?: any;
  rules?: ValidationRules;
  visibleWhen?: VisibilityCondition | VisibilityCondition[];
}

type LayoutNode = {
  kind: LayoutKind;
  fieldId?: string;
  colSpan?: number;
  title?: string;
  subtitle?: string;
  withDivider?: boolean;
  collapsible?: boolean;
  cols?: number;
  spacing?: 'sm' | 'md' | 'lg';
  children?: LayoutNode[];
};

interface FormSchema {
  id: string;
  meta: {
    title: string;
    subtitle?: string;
    description?: string;
  };
  fields: Record<string, FieldDefinition>;
  layout: LayoutNode[];
}

interface FormContextValue {
  schema: FormSchema;
  formValues: Record<string, any>;
  errors: Record<string, any>;
  touchedFields: Set<string>;
  isFieldVisible: (fieldId: string) => boolean;
  register: any;
  setValue: any;
}

const FormContext = createContext<FormContextValue | null>(null);

const useFormContext = () => {
  const context = useContext(FormContext);
  if (!context) throw new Error('useFormContext must be used within DynamicFormProvider');
  return context;
};

const buildZodSchema = (schema: FormSchema): z.ZodObject<any> => {
  const schemaShape: Record<string, z.ZodTypeAny> = {};

  Object.entries(schema.fields).forEach(([fieldId, fieldDef]) => {
    let fieldSchema: z.ZodTypeAny;

    switch (fieldDef.renderer) {
      case 'number':
        fieldSchema = z.coerce.number();
        break;
      case 'checkbox':
      case 'switch':
        fieldSchema = z.boolean();
        break;
      case 'multiselect':
        fieldSchema = z.array(z.string());
        break;
      default:
        fieldSchema = z.string();
    }

    const rules = fieldDef.rules;
    if (!rules) {
      schemaShape[fieldId] = fieldSchema.optional();
      return;
    }

    if (fieldSchema instanceof z.ZodString) {
      let stringSchema = fieldSchema as z.ZodString;
      
      if (rules.required) {
        const msg = typeof rules.required === 'string' ? rules.required : 'Required';
        stringSchema = stringSchema.min(1, msg);
      }
      if (rules.minLength) {
        stringSchema = stringSchema.min(rules.minLength.value, rules.minLength.message);
      }
      if (rules.maxLength) {
        stringSchema = stringSchema.max(rules.maxLength.value, rules.maxLength.message);
      }
      if (rules.pattern) {
        stringSchema = stringSchema.regex(rules.pattern.value, rules.pattern.message);
      }
      if (fieldDef.inputType === 'email') {
        stringSchema = stringSchema.email('Invalid email');
      }
      if (fieldDef.inputType === 'url') {
        stringSchema = stringSchema.url('Invalid URL');
      }
      
      fieldSchema = !rules.required ? stringSchema.optional() : stringSchema;
    }

    if (fieldSchema instanceof z.ZodNumber) {
      let numberSchema = fieldSchema as z.ZodNumber;
      
      if (rules.min) {
        numberSchema = numberSchema.min(rules.min.value, rules.min.message);
      }
      if (rules.max) {
        numberSchema = numberSchema.max(rules.max.value, rules.max.message);
      }
      
      fieldSchema = !rules.required ? numberSchema.optional() : numberSchema;
    }

    if (fieldSchema instanceof z.ZodBoolean && rules.required) {
      const msg = typeof rules.required === 'string' ? rules.required : 'Required';
      fieldSchema = fieldSchema.refine((val) => val === true, { message: msg });
    }

    if (fieldSchema instanceof z.ZodArray) {
      let arraySchema = fieldSchema as z.ZodArray<any>;
      
      if (rules.required) {
        const msg = typeof rules.required === 'string' ? rules.required : 'Required';
        arraySchema = arraySchema.min(1, msg);
      }
      
      fieldSchema = !rules.required ? arraySchema.optional() : arraySchema;
    }

    schemaShape[fieldId] = fieldSchema;
  });

  return z.object(schemaShape);
};

const getDefaultValues = (schema: FormSchema): Record<string, any> => {
  const defaults: Record<string, any> = {};
  Object.entries(schema.fields).forEach(([fieldId, fieldDef]) => {
    if (fieldDef.defaultValue !== undefined) {
      defaults[fieldId] = fieldDef.defaultValue;
    } else {
      switch (fieldDef.renderer) {
        case 'checkbox':
        case 'switch':
          defaults[fieldId] = false;
          break;
        case 'multiselect':
          defaults[fieldId] = [];
          break;
        default:
          defaults[fieldId] = '';
      }
    }
  });
  return defaults;
};

const evaluateVisibility = (conditions: any, formValues: Record<string, any>): boolean => {
  if (Array.isArray(conditions)) {
    return conditions.every((cond) => evaluateSingleCondition(cond, formValues));
  }
  return evaluateSingleCondition(conditions, formValues);
};

const evaluateSingleCondition = (condition: any, formValues: Record<string, any>): boolean => {
  const { field, op, value } = condition;
  const fieldValue = formValues[field];

  switch (op) {
    case 'equals':
      return fieldValue === value;
    case 'notEquals':
      return fieldValue !== value;
    case 'in':
      return Array.isArray(value) && value.includes(fieldValue);
    default:
      return true;
  }
};

const ErrorIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="icon-error">
    <circle cx="10" cy="10" r="9" fill="#FEE2E2" />
    <circle cx="10" cy="10" r="8" stroke="#DC2626" strokeWidth="1.5" />
    <path d="M7 7L13 13M13 7L7 13" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const SuccessIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="icon-success">
    <circle cx="10" cy="10" r="9" fill="#D1FAE5" />
    <circle cx="10" cy="10" r="8" stroke="#059669" strokeWidth="1.5" />
    <path d="M6 10L8.5 12.5L14 7" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TextField = ({ fieldId }: { fieldId: string }) => {
  const { schema, errors, touchedFields, register } = useFormContext();
  const field = schema.fields[fieldId];
  const error = errors[fieldId];
  const touched = touchedFields.has(fieldId);
  const hasError = !!error;
  const isValid = touched && !error;

  return (
    <div className="field-wrapper">
      <label htmlFor={fieldId} className="field-label">
        {field.label}
        {field.rules?.required && <span className="field-required">*</span>}
      </label>
      <div className={`field-input-container ${hasError ? 'has-error' : ''} ${isValid ? 'is-valid' : ''}`}>
        <input
          id={fieldId}
          type={field.inputType || 'text'}
          placeholder={field.placeholder}
          className="field-input"
          {...register(fieldId)}
        />
        <div className="field-icon">
          {hasError && <ErrorIcon />}
          {isValid && <SuccessIcon />}
        </div>
      </div>
      {hasError && (
        <div className="field-error-message">
          <ErrorIcon />
          <span>{error.message}</span>
        </div>
      )}
    </div>
  );
};

const TextareaField = ({ fieldId }: { fieldId: string }) => {
  const { schema, errors, touchedFields, register } = useFormContext();
  const field = schema.fields[fieldId];
  const error = errors[fieldId];
  const touched = touchedFields.has(fieldId);
  const hasError = !!error;
  const isValid = touched && !error;

  return (
    <div className="field-wrapper">
      <label htmlFor={fieldId} className="field-label">
        {field.label}
        {field.rules?.required && <span className="field-required">*</span>}
      </label>
      <div className={`field-input-container ${hasError ? 'has-error' : ''} ${isValid ? 'is-valid' : ''}`}>
        <textarea
          id={fieldId}
          placeholder={field.placeholder}
          rows={field.props?.minRows || 3}
          className="field-textarea"
          {...register(fieldId)}
        />
        <div className="field-icon">
          {hasError && <ErrorIcon />}
          {isValid && <SuccessIcon />}
        </div>
      </div>
      {hasError && (
        <div className="field-error-message">
          <ErrorIcon />
          <span>{error.message}</span>
        </div>
      )}
    </div>
  );
};

const SelectField = ({ fieldId }: { fieldId: string }) => {
  const { schema, errors, touchedFields, register } = useFormContext();
  const field = schema.fields[fieldId];
  const error = errors[fieldId];
  const touched = touchedFields.has(fieldId);
  const hasError = !!error;
  const isValid = touched && !error;
  const options = field.props?.data || [];

  return (
    <div className="field-wrapper">
      <label htmlFor={fieldId} className="field-label">
        {field.label}
        {field.rules?.required && <span className="field-required">*</span>}
      </label>
      <div className={`field-input-container ${hasError ? 'has-error' : ''} ${isValid ? 'is-valid' : ''}`}>
        <select id={fieldId} className="field-select" {...register(fieldId)}>
          <option value="">{field.placeholder || 'Select...'}</option>
          {options.map((opt: any, idx: number) => (
            <option key={idx} value={opt.value || opt}>
              {opt.label || opt}
            </option>
          ))}
        </select>
        <div className="field-icon">
          {hasError && <ErrorIcon />}
          {isValid && <SuccessIcon />}
        </div>
      </div>
      {hasError && (
        <div className="field-error-message">
          <ErrorIcon />
          <span>{error.message}</span>
        </div>
      )}
    </div>
  );
};

const CheckboxField = ({ fieldId }: { fieldId: string }) => {
  const { schema, errors, register } = useFormContext();
  const field = schema.fields[fieldId];
  const error = errors[fieldId];

  return (
    <div className="field-wrapper field-checkbox-wrapper">
      <div className="field-checkbox-container">
        <input id={fieldId} type="checkbox" className="field-checkbox" {...register(fieldId)} />
        <label htmlFor={fieldId} className="field-checkbox-label">
          {field.label}
          {field.rules?.required && <span className="field-required">*</span>}
        </label>
      </div>
      {error && (
        <div className="field-error-message">
          <ErrorIcon />
          <span>{error.message}</span>
        </div>
      )}
    </div>
  );
};

const RadioField = ({ fieldId }: { fieldId: string }) => {
  const { schema, errors, register } = useFormContext();
  const field = schema.fields[fieldId];
  const error = errors[fieldId];
  const options = field.props?.options || [];

  return (
    <div className="field-wrapper">
      <div className="field-label">
        {field.label}
        {field.rules?.required && <span className="field-required">*</span>}
      </div>
      <div className="field-radio-group">
        {options.map((option: any, index: number) => (
          <div key={index} className="field-radio-item">
            <input id={`${fieldId}-${index}`} type="radio" value={option.value} className="field-radio" {...register(fieldId)} />
            <label htmlFor={`${fieldId}-${index}`} className="field-radio-label">{option.label}</label>
          </div>
        ))}
      </div>
      {error && (
        <div className="field-error-message">
          <ErrorIcon />
          <span>{error.message}</span>
        </div>
      )}
    </div>
  );
};

const NumberField = ({ fieldId }: { fieldId: string }) => {
  const { schema, errors, touchedFields, register } = useFormContext();
  const field = schema.fields[fieldId];
  const error = errors[fieldId];
  const touched = touchedFields.has(fieldId);
  const hasError = !!error;
  const isValid = touched && !error;

  return (
    <div className="field-wrapper">
      <label htmlFor={fieldId} className="field-label">
        {field.label}
        {field.rules?.required && <span className="field-required">*</span>}
      </label>
      <div className={`field-input-container ${hasError ? 'has-error' : ''} ${isValid ? 'is-valid' : ''}`}>
        <input
          id={fieldId}
          type="number"
          placeholder={field.placeholder}
          min={field.props?.min}
          max={field.props?.max}
          step={field.props?.step || 1}
          className="field-input field-number"
          {...register(fieldId)}
        />
        <div className="field-icon">
          {hasError && <ErrorIcon />}
          {isValid && <SuccessIcon />}
        </div>
      </div>
      {hasError && (
        <div className="field-error-message">
          <ErrorIcon />
          <span>{error.message}</span>
        </div>
      )}
    </div>
  );
};

const SwitchField = ({ fieldId }: { fieldId: string }) => {
  const { schema, errors, register } = useFormContext();
  const field = schema.fields[fieldId];
  const error = errors[fieldId];

  return (
    <div className="field-wrapper field-switch-wrapper">
      <div className="field-switch-container">
        <label htmlFor={fieldId} className="field-switch-label">
          {field.label}
          {field.rules?.required && <span className="field-required">*</span>}
        </label>
        <div className="field-switch">
          <input id={fieldId} type="checkbox" className="field-switch-input" {...register(fieldId)} />
          <span className="field-switch-slider"></span>
        </div>
      </div>
      {error && (
        <div className="field-error-message">
          <ErrorIcon />
          <span>{error.message}</span>
        </div>
      )}
    </div>
  );
};
const FieldRenderer = ({ fieldId }: { fieldId: string }) => {
  const { schema, isFieldVisible } = useFormContext();
  const field = schema.fields[fieldId];

  if (!field || !isFieldVisible(fieldId)) return null;

  switch (field.renderer) {
    case 'text':
      return <TextField fieldId={fieldId} />;
    case 'textarea':
      return <TextareaField fieldId={fieldId} />;
    case 'select':
      return <SelectField fieldId={fieldId} />;
    case 'checkbox':
      return <CheckboxField fieldId={fieldId} />;
    case 'radio':
      return <RadioField fieldId={fieldId} />;
    case 'number':
      return <NumberField fieldId={fieldId} />;
    case 'switch':  // ← Make sure this exists
      return <SwitchField fieldId={fieldId} />;
    default:
      return null;
  }
};

const LayoutRenderer = ({ layout }: { layout: LayoutNode }) => {
  switch (layout.kind) {
    case 'field':
      return <FieldRenderer fieldId={layout.fieldId!} />;

    case 'stack':
      return (
        <div className={`layout-stack layout-spacing-${layout.spacing || 'md'}`}>
          {layout.children?.map((child, index) => (
            <LayoutRenderer key={index} layout={child} />
          ))}
        </div>
      );

    case 'grid':
      return (
        <div className={`layout-grid layout-spacing-${layout.spacing || 'md'}`} style={{ gridTemplateColumns: `repeat(${layout.cols || 2}, 1fr)` }}>
          {layout.children?.map((child, index) => (
            <div key={index} style={{ gridColumn: `span ${(child as any).colSpan || 1}` }}>
              <LayoutRenderer layout={child} />
            </div>
          ))}
        </div>
      );

    case 'section':
      return (
        <div className="layout-section">
          {layout.title && (
            <>
              <div className="layout-section-header">
                <h3 className="layout-section-title">{layout.title}</h3>
                {layout.subtitle && <p className="layout-section-subtitle">{layout.subtitle}</p>}
              </div>
              {layout.withDivider !== false && <div className="layout-section-divider" />}
            </>
          )}
          <div className="layout-section-content">
            {layout.children?.map((child, index) => (
              <LayoutRenderer key={index} layout={child} />
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
};

interface DynamicFormProps {
  schema: FormSchema;
  onSubmit: (data: any) => void | Promise<void>;
  submitButtonText?: string;
  showMeta?: boolean;
  className?: string;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  schema,
  onSubmit,
  submitButtonText = 'Submit',
  showMeta = true,
  className = '',
}) => {
  const zodSchema = useMemo(() => buildZodSchema(schema), [schema]);
  const defaultValues = useMemo(() => getDefaultValues(schema), [schema]);

  const { register, handleSubmit, watch, setValue, formState: { errors, touchedFields } } = useForm({
    resolver: zodResolver(zodSchema),
    defaultValues,
    mode: 'onChange',
  });

  const formValues = watch();

  const isFieldVisible = (fieldId: string): boolean => {
    const field = schema.fields[fieldId];
    if (!field?.visibleWhen) return true;
    return evaluateVisibility(field.visibleWhen, formValues);
  };

  const contextValue: FormContextValue = {
    schema,
    formValues,
    errors,
    touchedFields: new Set(Object.keys(touchedFields)),
    isFieldVisible,
    register,
    setValue,
  };

  return (
    <FormContext.Provider value={contextValue}>
      <div className={`dynamic-form ${className}`}>
        {showMeta && (schema.meta.title || schema.meta.subtitle) && (
          <div className="dynamic-form-header">
            {schema.meta.title && <h2 className="dynamic-form-title">{schema.meta.title}</h2>}
            {schema.meta.subtitle && <p className="dynamic-form-subtitle">{schema.meta.subtitle}</p>}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="dynamic-form-body">
          {schema.layout.map((layoutNode, index) => (
            <LayoutRenderer key={index} layout={layoutNode} />
          ))}

          <div className="dynamic-form-footer">
            <button type="submit" className="dynamic-form-submit">
              {submitButtonText}
            </button>
          </div>
        </form>
      </div>
    </FormContext.Provider>
  );
};

export default DynamicForm;