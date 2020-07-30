
function lnqSchemaForm() {


  const schema = {

    title: "Lymph Node Quantification Form",
    type: "object",

    definitions: {
      "Location": {
        title: "Location",
        type: "string",
        oneOf: [
          { "type": "string", "enum": [ "1" ], "title": "Not a lymph node" },
          { "type": "string", "enum": [ "59441001" ], "title": "Lymph node" },
          { "type": "string", "enum": [ "81105003" ], "title": "Cervical lymph node" },
          { "type": "string", "enum": [ "76838003" ], "title": "Supraclavicular lymph node" },
          { "type": "string", "enum": [ "62683002" ], "title": "Mediastinal lymph node" },
          { "type": "string", "enum": [ "68171009" ], "title": "Axillary lymph node" },
          { "type": "string", "enum": [ "53074004" ], "title": "Hilar lymph node" },
          { "type": "string", "enum": [ "196516004" ], "title": "Pericardial lymph node" },
          { "type": "string", "enum": [ "890324005" ], "title": "Retrocrural lymph node" },
          { "type": "string", "enum": [ "279795009" ], "title": "Mesenteric lymph node" },
          { "type": "string", "enum": [ "61492009" ], "title": "Periportal lymph node" },
          { "type": "string", "enum": [ "91394001" ], "title": "Retroperitoneal lymph node" },
          { "type": "string", "enum": [ "84219008" ], "title": "Iliac lymph node" },
          { "type": "string", "enum": [ "54268001" ], "title": "Pelvic lymph node" },
          { "type": "string", "enum": [ "8928004" ], "title": "Inguinal lymph node" },
        ]
      },
    },

    properties: {
      location: { title: "Location", "$ref": "#/definitions/Location" },
      modifiers: { title: "Modifiers", type: "array",
        items: {
          enum: ["Left", "Right", "Confluent", "Artifact", "Necrotic", "Includes non-nodal mass", "Pathologic"]
        },
        uniqueItems: true,
      },
      comments: { title: "Additional Comments", type: "string" },
      metadata: {
        title: "Metadata",
        description: "These fields will be filled out by the software that creates the annotation",
        type: "object",
        properties: {
          annotatorID: {type: "string", title: "Annotator ID"},
          software: {type: "string", title: "Software"},
          softwareVersion: {type: "string", title: "Software Version"},
          contentCreationDate: {type: "string", format: "date", title: "Content Creation Date"},
          studyInstanceUID: {type: "string", title: "StudyInstanceUID"},
        },
        required: ["annotatorID", "software", "softwareVersion", "contentCreationDate", "studyInstanceUID"],
      }
    },
    required: ["location", "metadata"],
  };

  const uiSchema = {
    "ui:order": ["location", "modifiers", "comments", "metadata"],
    location: {
      "ui:emptyValue": "Select a location"
    },
    modifiers: {
      "ui:widget": "checkboxes"
    },
    comments: {
      "ui:widget": "textarea"
    }
  }

  const formData = {
    metadata: {
      annotatorID: "TI",
      software: "3D Slicer",
      softwareVersion: "4.11",
      contentCreationDate: "2020-07-30",
      studyInstanceUID: "2.25.3299837243769834768937629737637"
    }
  }

  const customValidation = (formData, errors) => {
    /* add custom logic if needed
    if (!formData.approved) {
      errors.approved.addError("Form must be approved to submit");
    }
    */
    return errors;
  }

  const customOnChange = (data) => {
  }

  const log = (type) => console.log.bind(console, type);

  const displayResult = (submitted) => {
    const paragraph = document.createElement("p");
    paragraph.innerText = JSON.stringify(submitted.formData);
    document.body.appendChild(paragraph);
  };

  const formElementProperties = {
    schema,
    uiSchema,
    formData,
    validate: customValidation,
    showErrorList: true,
    onChange: customOnChange,
    onSubmit: displayResult,
    onError: log("errors"),
  };

  const Form = JSONSchemaForm.default;
  const formElement = React.createElement(Form, formElementProperties);
  const app = document.getElementById("app");

  ReactDOM.render(formElement, app);
}
