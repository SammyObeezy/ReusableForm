import { useState } from 'react'
import './App.css'
import { DynamicForm } from './Components/Dynamic'
import './Components/Dynamic.css'
import { 
  contactFormSchema,
  registrationFormSchema,
  agentUpdateSchema,
  productFormSchema,
  addressFormSchema,
  jobApplicationSchema,
  insuranceQuoteSchema
} from './schema/formSchema'

function App() {
  const [activeForm, setActiveForm] = useState('contact');

  const forms = {
    contact: { schema: contactFormSchema, button: 'Send Message' },
    registration: { schema: registrationFormSchema, button: 'Create Account' },
    agent: { schema: agentUpdateSchema, button: 'Update Agent' },
    product: { schema: productFormSchema, button: 'Add Product' },
    address: { schema: addressFormSchema, button: 'Save Address' },
    job: { schema: jobApplicationSchema, button: 'Submit Application' },
    insurance: { schema: insuranceQuoteSchema, button: 'Get Quote' }
  };

  const handleSubmit = async (data: any) => {
    console.log('Form submitted:', data);
    alert(`${activeForm} form submitted! Check console.`);
  };

  return (
    <div className="app-container">
      <div className="form-selector">
        {Object.keys(forms).map((key) => (
          <button
            key={key}
            onClick={() => setActiveForm(key)}
            className={activeForm === key ? 'active' : ''}
          >
            {key.toUpperCase()}
          </button>
        ))}
      </div>

      <DynamicForm 
        schema={forms[activeForm as keyof typeof forms].schema}
        onSubmit={handleSubmit}
        submitButtonText={forms[activeForm as keyof typeof forms].button}
        showMeta={true}
      />
    </div>
  )
}

export default App