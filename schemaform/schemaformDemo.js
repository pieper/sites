
function schemaformDemo() {
  const commonSchemaDefinitions = {};

  commonSchemaDefinitions.stringArray = { type: "array", items: { type: "string" }};

  const schema = {
    definitions: commonSchemaDefinitions,
    title: "Schema Generated Form",
    type: "object",
    properties: {
      title: {type: "string", title: "Title", default: "Untitled Form"},
      quality: {type: "boolean", title: "Is the data okay to use?", default: false, enumNames: ["Yes", "No"]},
      approved: {type: "boolean", title: "Approved", default: false},
      when: {type: "string", format: "date", title: "When did you look at it?"},
      score: {type: "number", enum: [10, 20, 30], enumNames: ["ten", "twenty", "thirty"]},
      comments: { "$ref": "#/definitions/stringArray", title: "Comments" },
      addAdditionalComments: { type: "boolean", title: "Add additional comments" },
    },
    required: ["title"],
    dependencies: { 
      "addAdditionalComments": {
        "properties": {
          "additionalComments": {"$ref": "#/definitions/stringArray", title: "Additional Comments"}
        }
      }
    },
  };
const morphoDepotSchema = {
  "type": "object",
  "properties": {
    "Is your data from a commercially acquired organism or from an accessioned specimen (i.e., from a natural history collection). ": {
      "title": "Is your data from a commercially acquired organism or from an accessioned specimen (i.e., from a natural history collection). ",
      "type": "string",
      "enum": [
        "Commercially acquired",
        "Accessioned specimen"
      ]
    },
    "Data from accessioned specimen": {
      "title": "Data from accessioned specimen",
      "type": "null"
    },
    "Is the specimen in iDigBio database. ": {
      "title": "Is the specimen in iDigBio database. ",
      "type": "string",
      "enum": [
        "Yes",
        "No"
      ]
    },
    "Go to iDigBio portal, search for the specimen, click the link and paste the URL below (it should look something like this: https://www.idigbio.org/portal/records/b328320d-268e-4bfc-ae70-1c00f0891f89) ": {
      "title": "Go to iDigBio portal, search for the specimen, click the link and paste the URL below (it should look something like this: https://www.idigbio.org/portal/records/b328320d-268e-4bfc-ae70-1c00f0891f89) ",
      "type": "string"
    },
    "Commercially acquired or unaccessioned specimens": {
      "title": "Commercially acquired or unaccessioned specimens",
      "type": "null"
    },
    "Kingdom": {
      "title": "Kingdom",
      "type": "string"
    },
    "Class": {
      "title": "Class",
      "type": "string"
    },
    "Family": {
      "title": "Family",
      "type": "string"
    },
    "Genus": {
      "title": "Genus",
      "type": "string"
    },
    "Species": {
      "title": "Species",
      "type": "string"
    },
    "Sex": {
      "title": "Sex",
      "type": "string",
      "enum": [
        "Male",
        "Female",
        "Unknown"
      ]
    },
    "Developmental Stage": {
      "title": "Developmental Stage",
      "type": "string",
      "enum": [
        "Prenatal (fetus, embryo)",
        "Juvenile (neonatal to subadult)",
        "Adult"
      ]
    },
    "Image Data description": {
      "title": "Image Data description",
      "type": "null"
    },
    "What is the modality of acquisition?": {
      "title": "What is the modality of acquisition?",
      "type": "string",
      "enum": [
        "Micro CT (or synchrotron)",
        "Medical CT",
        "MRI",
        "Lightsheet microscopy",
        "3D confocal microscopy",
        "Surface model (photogrammetry, structural light or laser scanning)"
      ]
    },
    "Is there contrast enhancement treatment applied to the specimen (iodine, phosphotungstenic acid, gadolinium, casting agents, etc). ": {
      "title": "Is there contrast enhancement treatment applied to the specimen (iodine, phosphotungstenic acid, gadolinium, casting agents, etc). ",
      "type": "string",
      "enum": [
        "Yes",
        "No"
      ]
    },
    "What is in the image?": {
      "title": "What is in the image?",
      "type": "string",
      "enum": [
        "Whole specimen",
        "Partial specimen"
      ]
    },
    "Partial Specimen questions": {
      "title": "Partial Specimen questions",
      "type": "null"
    },
    "What anatomical area(s) is/are present in the scan?": {
      "title": "What anatomical area(s) is/are present in the scan?",
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "Head and neck (e.g., cranium, mandible, proximal vertebral colum)",
          "Pectoral girdle",
          "Forelimb",
          "Trunk (e.g., body cavity, torso, spine, ribs)",
          "Pelvic girdle",
          "Hindlimb",
          "Tail"
        ]
      }
    },
    "License choices": {
      "title": "License choices",
      "type": "null"
    },
    "Acknowledgement": {
      "title": "Acknowledgement",
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "I have the right to allow redistribution of this data."
        ]
      }
    },
    "Choose a license": {
      "title": "Choose a license",
      "type": "string",
      "enum": [
        "CC BY 4.0 (requires attribution, allows commercial usage)",
        "CC BY-NC 4.0 (requires attribution, non-commercial usage only)"
      ]
    },
    "Github related": {
      "title": "Github related",
      "type": "null"
    },
    "What should the repository in your github account called. This needs to be unique value. ": {
      "title": "What should the repository in your github account called. This needs to be unique value. ",
      "type": "string"
    }
  }
};
  
  const uiSchema = {
    "ui:order": ["title", "comments", "when", "*", "approved"],
    comments: {
      "ui:options": {
        orderable: true
      }
    },
    quality: {
      "ui:widget": "radio"
    }

  }

  const formData = {
    title: "Untitled",
    approved: false,
    when: "tbd",
    comments: [
      "one", "two", "and more"
    ]
  }

  let morphoDepotFormData = {};

  const customValidation = (formData, errors) => {
    if (!formData.approved) {
      errors.approved.addError("Form must be approved to submit");
    }
    return errors;
  }

  const customOnChange = (data) => {
    // note: this works with the "dependencies" but adds hiding when unchecked
    const titleElement = document.getElementById('root_additionalComments__title');
    // TODO: make this work for newer schemaform code https://github.com/mozilla-services/react-jsonschema-form/issues/1042
    if (titleElement && titleElement.parentElement && titleElement.parentElement.parentElement) {
      const fieldElement = titleElement.parentElement.parentElement;
      fieldElement.hidden = ! data.formData.addAdditionalComments;
    }
  }

  const log = (type) => console.log.bind(console, type);
  const formElementProperties = {
    //schema,
    morphoDepotSchema,
    uiSchema,
    //formData,
    morphoDepotFormData,
    validate: customValidation,
    showErrorList: false,
    onChange: customOnChange,
    onSubmit: log("submitted"),
    onError: log("errors"),
  };

  const Form = JSONSchemaForm.default;
  const formElement = React.createElement(Form, formElementProperties);
  const app = document.getElementById("app");

  ReactDOM.render(formElement, app);
}
