import { FacturaScriptsClient } from '../../../fs/client.js';

export const toolDefinition = {
  name: 'get_proveedores',
  description: 'Obtiene la lista de proveedores con paginación y filtros avanzados',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Número máximo de registros a devolver (por defecto: 50)',
        default: 50,
      },
      offset: {
        type: 'number',
        description: 'Número de registros a omitir (por defecto: 0)',
        default: 0,
      },
      filter: {
        type: 'string',
        description: 'Filtros dinámicos. Formato: "campo:valor" o "campo1:valor1,campo2:valor2". Soporta operadores avanzados: campo_gt:valor, campo_like:texto, etc.',
      },
      order: {
        type: 'string',
        description: 'Orden en formato "campo:asc|desc" o múltiple "campo1:asc,campo2:desc"',
      },
    },
  },
};

export const toolImplementation = async (resource: any, buildUri: (resourceName: string) => string) => {
  const uri = buildUri('proveedores');
  const result = await resource.getResource(uri);
  return {
    content: [
      {
        type: 'text',
        text: (result as any).contents?.[0]?.text || 'No data',
      },
    ],
  };
};

export const createProveedorToolDefinition = {
  name: 'create_proveedor',
  description: 'Crea un nuevo proveedor en FacturaScripts. Permite especificar nombre, CIF/NIF, datos de contacto, forma de pago y dirección postal completa.',
  inputSchema: {
    type: 'object',
    properties: {
      nombre: {
        type: 'string',
        description: 'Nombre del proveedor (requerido)',
      },
      razonsocial: {
        type: 'string',
        description: 'Razón social del proveedor. Si no se indica, se usa el nombre.',
      },
      cifnif: {
        type: 'string',
        description: 'CIF/NIF del proveedor (requerido por FacturaScripts)',
      },
      email: {
        type: 'string',
        description: 'Email de contacto del proveedor',
      },
      telefono1: {
        type: 'string',
        description: 'Teléfono principal del proveedor',
      },
      telefono2: {
        type: 'string',
        description: 'Teléfono secundario del proveedor',
      },
      web: {
        type: 'string',
        description: 'Página web del proveedor',
      },
      codpago: {
        type: 'string',
        description: 'Código de forma de pago (ej: TRANS, CONT, TAR)',
      },
      observaciones: {
        type: 'string',
        description: 'Observaciones o notas sobre el proveedor',
      },
      tipoidfiscal: {
        type: 'string',
        description: 'Tipo de identificador fiscal (ej: CIF, NIF, NIE)',
      },
      regimeniva: {
        type: 'string',
        description: 'Régimen de IVA del proveedor',
      },
      direccion: {
        type: 'string',
        description: 'Dirección postal del proveedor (calle, número, piso, etc.)',
      },
      codpostal: {
        type: 'string',
        description: 'Código postal',
      },
      ciudad: {
        type: 'string',
        description: 'Ciudad',
      },
      provincia: {
        type: 'string',
        description: 'Provincia',
      },
      codpais: {
        type: 'string',
        description: 'Código de país ISO (ej: ESP, FRA, DEU). Por defecto: ESP',
      },
      apartado: {
        type: 'string',
        description: 'Apartado de correos',
      },
    },
    required: ['nombre', 'cifnif'],
  },
};

export async function createProveedorImplementation(
  args: Record<string, any>,
  client: FacturaScriptsClient
) {
  try {
    if (!args.nombre || typeof args.nombre !== 'string' || args.nombre.trim() === '') {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Parámetro requerido',
            message: 'El nombre del proveedor es obligatorio y no puede estar vacío.',
          }, null, 2),
        }],
        isError: true,
      };
    }

    if (!args.cifnif || typeof args.cifnif !== 'string' || args.cifnif.trim() === '') {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Parámetro requerido',
            message: 'El CIF/NIF del proveedor es obligatorio y no puede estar vacío.',
          }, null, 2),
        }],
        isError: true,
      };
    }

    const proveedorData: Record<string, any> = {
      nombre: args.nombre.trim(),
      cifnif: args.cifnif.trim(),
      razonsocial: args.razonsocial?.trim() || args.nombre.trim(),
    };

    if (args.email) proveedorData.email = args.email.trim();
    if (args.telefono1) proveedorData.telefono1 = args.telefono1.trim();
    if (args.telefono2) proveedorData.telefono2 = args.telefono2.trim();
    if (args.web) proveedorData.web = args.web.trim();
    if (args.codpago) proveedorData.codpago = args.codpago.trim();
    if (args.observaciones) proveedorData.observaciones = args.observaciones.trim();
    if (args.tipoidfiscal) proveedorData.tipoidfiscal = args.tipoidfiscal.trim();
    if (args.regimeniva) proveedorData.regimeniva = args.regimeniva.trim();

    const result = await client.post<any>('/proveedores', proveedorData);

    // If address fields are provided, update the auto-generated contact
    // FacturaScripts creates a contact (contacto) automatically when a provider is created.
    // Address fields live in the contact, not the provider.
    const addressFields: Record<string, string> = {};
    if (args.direccion) addressFields.direccion = args.direccion.trim();
    if (args.codpostal) addressFields.codpostal = args.codpostal.trim();
    if (args.ciudad) addressFields.ciudad = args.ciudad.trim();
    if (args.provincia) addressFields.provincia = args.provincia.trim();
    if (args.codpais) addressFields.codpais = args.codpais.trim();
    if (args.apartado) addressFields.apartado = args.apartado.trim();

    let contactoInfo: any = null;
    if (Object.keys(addressFields).length > 0) {
      const proveedorEntity = result?.data ?? result;
      const idcontacto = proveedorEntity?.idcontacto;

      if (idcontacto) {
        try {
          const contactoResult = await client.put<any>(
            `/contactos/${idcontacto}`,
            addressFields
          );
          contactoInfo = {
            success: true,
            idcontacto,
            direccion_actualizada: addressFields,
          };
        } catch (contactoError) {
          const msg = contactoError instanceof Error ? contactoError.message : 'Error desconocido';
          contactoInfo = {
            warning: `Proveedor creado pero no se pudo actualizar la dirección del contacto: ${msg}`,
            idcontacto,
          };
        }
      } else {
        contactoInfo = {
          warning: 'Proveedor creado pero no se encontró idcontacto para actualizar la dirección.',
        };
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Proveedor "${(result?.data ?? result).nombre}" creado correctamente.`,
          ...(contactoInfo ? { contacto: contactoInfo } : {}),
          data: result?.data ?? result,
        }, null, 2),
      }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    const axiosError = error as any;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'Error al crear proveedor',
          message: errorMessage,
          details: axiosError?.response?.data || null,
        }, null, 2),
      }],
      isError: true,
    };
  }
}