
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

          { "type": "string", "enum": [ "59441001" ], "title": "Lymph Node Other" },
          { "type": "string", "enum": [ "81105003" ], "title": "Lymph Node Cervical" },
          { "type": "string", "enum": [ "312501005" ], "title": "Lymph Node of Head and Neck" },
          { "type": "string", "enum": [ "76838003" ], "title": "Lymph Node Supraclavicular" },
          { "type": "string", "enum": [ "47109002" ], "title": "Lymph Node of Thorax" },
          { "type": "string", "enum": [ "62683002" ], "title": "Lymph Node Mediastinal" },
          { "type": "string", "enum": [ "53074004" ], "title": "Lymph Node Hilar" },
          { "type": "string", "enum": [ "196751009" ], "title": "Lymph Node Pericardial" },
          { "type": "string", "enum": [ "890324005" ], "title": "Lymph Node Retrocrural" },
          { "type": "string", "enum": [ "68171009" ], "title": "Lymph Node Axillary" },
          { "type": "string", "enum": [ "8568009" ], "title": "Lymph Node Abdominal" },
          { "type": "string", "enum": [ "279795009" ], "title": "Lymph Node Mesenteric" },
          { "type": "string", "enum": [ "61492009" ], "title": "Lymph Node Periportal" },
          { "type": "string", "enum": [ "91394001" ], "title": "Lymph Node Retroperitoneal" },
          { "type": "string", "enum": [ "84219008" ], "title": "Lymph Node Iliac" },
          { "type": "string", "enum": [ "54268001" ], "title": "Lymph Node Pelvic" },
          { "type": "string", "enum": [ "8928004" ], "title": "Lymph Node Inguinal" },
        ]
      },
      "CervicalLymphNodeSubtypes": {
        title: "Cervical Lymph Node Subtypes",
        type: "string",
        oneOf: [
          { "type": "string", "enum": [ "9659009" ], "title": "Infraclavicular lymph node" },
          { "type": "string", "enum": [ "245324000" ], "title": "Posterior triangle cervical lymph node" },
          { "type": "string", "enum": [ "5727003" ], "title": "Anterior cervical lymph node" },
          { "type": "string", "enum": [ "155237005" ], "title": "Inferior auricular lymph node" },
          { "type": "string", "enum": [ "58130000" ], "title": "Jugular lymph node" },
          { "type": "string", "enum": [ "81132008" ], "title": "Scalene lymph node" },
          { "type": "string", "enum": [ "59503006" ], "title": "Submandibular lymph node" },
          { "type": "string", "enum": [ "76838003" ], "title": "Supraclavicular lymph node" },
          { "type": "string", "enum": [ "279144003" ], "title": "Superficial cervical lymph node" },
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
    dependencies: {
      location: {
        oneOf: [ {
          properties: {
            location: {
              enum: [ "1", "59441001" ]
            },
            subtype: {
              type: "string"
            }
          },
          properties: {
            location: {
              enum: [ "81105003" ]
            },
            subtype: { "$ref": "#/definitions/CervicalLymphNodeSubtypes"}
          }
        }]
      }
    },
    required: ["location", "metadata"],
  };

  const uiSchema = {
    "ui:order": ["location", "subtype", "modifiers", "comments", "metadata"],
    location: {
      "ui:help": "Choose the optionthat best describes the location of the lymph node",
      "ui:emptyValue": "Select a location"
    },
    modifiers: {
      "ui:widget": "checkboxes"
    },
    comments: {
      "ui:widget": "textarea"
    },
    subtype: {
      "ui:widget": "radio"
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
