const { NumberField, StringField, SchemaField } = foundry.data.fields;

export const int = (initial = 0, options = {}) =>
  new NumberField({ required: true, nullable: false, integer: true, initial, ...options });

export const str = (initial = "", options = {}) =>
  new StringField({ required: true, blank: true, initial, ...options });

export const choice = (choices, initial) =>
  new StringField({ required: true, blank: false, choices, initial });

/** {value, max} 资源；max 存在于结构中以便 Token 资源条识别，角色卡会在派生阶段覆盖。 */
export const resource = (initial = 0) =>
  new SchemaField({ value: int(initial), max: int(initial, { min: 0 }), bonus: int(0) });
