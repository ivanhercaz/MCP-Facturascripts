import { CallToolRequest, CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { FacturaScriptsClient } from '../../../fs/client.js';
import type { FacturaProveedor } from '../../../types/facturascripts.js';

export const facturaProveedoresTool: Tool = {
  name: 'get_facturaproveedores',
  description: 'Obtener facturas de proveedores con paginación y filtros',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Número de registros a devolver (por defecto: 50)',
        default: 50,
      },
      offset: {
        type: 'number',
        description: 'Número de registros a omitir (por defecto: 0)',
        default: 0,
      },
      filter: {
        type: 'string',
        description: 'Filtros en formato campo:valor (ej: estado:pendiente)',
      },
      order: {
        type: 'string',
        description: 'Orden en formato campo:asc|desc (ej: fecha:desc)',
      },
    },
  },
};

export async function handleFacturaProveedoresCall(
  client: FacturaScriptsClient,
  request: CallToolRequest
): Promise<CallToolResult> {
  try {
    const { limit = 50, offset = 0, filter, order } = request.params as {
      limit?: number;
      offset?: number;
      filter?: string;
      order?: string;
    };

    const additionalParams: Record<string, string> = {};
    if (filter) additionalParams.filter = filter;
    if (order) additionalParams.order = order;

    const result = await client.getWithPagination<FacturaProveedor>(
      '/facturaproveedores',
      limit,
      offset,
      additionalParams
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'Failed to fetch facturaproveedores',
            message: errorMessage,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

interface LineaFactura {
  descripcion: string;
  cantidad: number;
  pvpunitario: number;
  referencia?: string;
  codimpuesto?: string;
  dtopor?: number;
}

export const createFacturaProveedorToolDefinition = {
  name: 'create_factura_proveedor',
  description: 'Crea una nueva factura de proveedor en FacturaScripts. Permite especificar el proveedor, fecha, número de factura del proveedor y líneas de detalle con productos/servicios.',
  inputSchema: {
    type: 'object',
    properties: {
      codproveedor: {
        type: 'string',
        description: 'Código del proveedor (requerido). Usar get_proveedores para obtener códigos.',
      },
      fecha: {
        type: 'string',
        description: 'Fecha de la factura en formato YYYY-MM-DD (por defecto: hoy)',
      },
      numproveedor: {
        type: 'string',
        description: 'Número de factura asignado por el proveedor',
      },
      codalmacen: {
        type: 'string',
        description: 'Código del almacén (ej: ALG)',
      },
      codpago: {
        type: 'string',
        description: 'Código de forma de pago (ej: TRANS, CONT)',
      },
      codserie: {
        type: 'string',
        description: 'Código de serie de la factura (ej: A, B, R). Usar get_series para ver las series disponibles.',
      },
      observaciones: {
        type: 'string',
        description: 'Observaciones o notas sobre la factura',
      },
      pagada: {
        type: 'boolean',
        description: 'Marcar la factura como pagada al crearla (por defecto: false). Busca el recibo generado automáticamente y lo marca como pagado.',
      },
      lineas: {
        type: 'array',
        description: 'Líneas de la factura (requerido, al menos una)',
        items: {
          type: 'object',
          properties: {
            descripcion: {
              type: 'string',
              description: 'Descripción del producto/servicio (requerido)',
            },
            cantidad: {
              type: 'number',
              description: 'Cantidad (requerido)',
            },
            pvpunitario: {
              type: 'number',
              description: 'Precio unitario sin IVA (requerido)',
            },
            referencia: {
              type: 'string',
              description: 'Referencia o código del producto',
            },
            codimpuesto: {
              type: 'string',
              description: 'Código del impuesto (ej: IVA21, IVA10, IVA4). Por defecto: IVA21',
            },
            dtopor: {
              type: 'number',
              description: 'Porcentaje de descuento (0-100)',
            },
          },
          required: ['descripcion', 'cantidad', 'pvpunitario'],
        },
      },
    },
    required: ['codproveedor', 'lineas'],
  },
};

export async function createFacturaProveedorImplementation(
  args: Record<string, any>,
  client: FacturaScriptsClient
) {
  try {
    if (!args.codproveedor || typeof args.codproveedor !== 'string' || args.codproveedor.trim() === '') {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Parámetro requerido',
            message: 'El código del proveedor (codproveedor) es obligatorio.',
          }, null, 2),
        }],
        isError: true,
      };
    }

    if (!args.lineas || !Array.isArray(args.lineas) || args.lineas.length === 0) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Parámetro requerido',
            message: 'Se requiere al menos una línea en la factura.',
          }, null, 2),
        }],
        isError: true,
      };
    }

    // Validate each line
    for (let i = 0; i < args.lineas.length; i++) {
      const linea = args.lineas[i];
      if (!linea.descripcion || typeof linea.descripcion !== 'string') {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'Error de validación',
              message: `Línea ${i + 1}: la descripción es obligatoria.`,
            }, null, 2),
          }],
          isError: true,
        };
      }
      if (typeof linea.cantidad !== 'number' || linea.cantidad <= 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'Error de validación',
              message: `Línea ${i + 1}: la cantidad debe ser un número mayor que 0.`,
            }, null, 2),
          }],
          isError: true,
        };
      }
      if (typeof linea.pvpunitario !== 'number' || linea.pvpunitario < 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'Error de validación',
              message: `Línea ${i + 1}: el precio unitario debe ser un número no negativo.`,
            }, null, 2),
          }],
          isError: true,
        };
      }
    }

    const codproveedor = args.codproveedor.trim();

    // Build lines array for the JSON parameter
    const lineas: LineaFactura[] = args.lineas.map((l: any) => ({
      descripcion: l.descripcion.trim(),
      cantidad: l.cantidad,
      pvpunitario: l.pvpunitario,
      ...(l.referencia?.trim() ? { referencia: l.referencia.trim() } : {}),
      ...(l.codimpuesto?.trim() ? { codimpuesto: l.codimpuesto.trim() } : {}),
      ...(l.dtopor ? { dtopor: l.dtopor } : {}),
    }));

    // Step 1: Create invoice with lines via dedicated endpoint
    // Uses /crearFacturaProveedor which creates the document, saves lines,
    // and calls Calculator::calculate() to compute neto/totaliva/total atomically.
    const facturaData: Record<string, any> = {
      codproveedor,
      lineas: JSON.stringify(lineas),
      fecha: args.fecha || new Date().toISOString().split('T')[0],
    };

    if (args.numproveedor) facturaData.numproveedor = args.numproveedor.trim();
    if (args.codalmacen) facturaData.codalmacen = args.codalmacen.trim();
    if (args.codpago) facturaData.codpago = args.codpago.trim();
    if (args.codserie) facturaData.codserie = args.codserie.trim();
    if (args.observaciones) facturaData.observaciones = args.observaciones.trim();

    const crearResult = await client.post<any>('/crearFacturaProveedor', facturaData);

    // Response format: { doc: { ... }, lines: [ ... ] }
    const facturaEntity = crearResult?.doc ?? crearResult?.data?.doc ?? crearResult;
    const lineasCreadas = crearResult?.lines ?? crearResult?.data?.lines ?? [];
    const rawId = facturaEntity?.idfactura;
    const idfactura = rawId ? Number(rawId) : null;

    if (!idfactura) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Error al crear factura',
            message: 'La factura se creó pero no se obtuvo el idfactura del servidor.',
            data: crearResult,
          }, null, 2),
        }],
        isError: true,
      };
    }

    // Step 2: If pagada=true, use the dedicated pagarFacturaProveedor endpoint
    let facturaFinal: any = facturaEntity;
    let pagoInfo: any = null;
    if (args.pagada === true) {
      try {
        const pagoData: Record<string, any> = {
          fechapago: facturaData.fecha,
          codpago: facturaData.codpago || '',
          pagada: 1,
        };
        await client.post<any>(
          `/pagarFacturaProveedor/${idfactura}`,
          pagoData
        );

        pagoInfo = {
          success: true,
          message: 'Factura marcada como pagada correctamente.',
        };

        // Re-fetch invoice to reflect updated payment status
        try {
          facturaFinal = await client.get<any>(`/facturaproveedores/${idfactura}`);
        } catch {
          // Keep previous facturaFinal
        }
      } catch (pagoError) {
        const msg = pagoError instanceof Error ? pagoError.message : 'Error desconocido';
        pagoInfo = { error: `Error al marcar factura como pagada: ${msg}` };
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Factura de proveedor creada correctamente con ${lineasCreadas.length} línea(s).`,
          resumen: {
            codigo: facturaFinal.codigo || facturaFinal.numero || 'N/A',
            idfactura,
            codproveedor,
            fecha: facturaData.fecha,
            num_lineas: lineasCreadas.length,
            neto: facturaFinal.neto ?? 0,
            totaliva: facturaFinal.totaliva ?? 0,
            total: facturaFinal.total ?? 0,
            pagada: facturaFinal.pagada ?? false,
          },
          ...(pagoInfo ? { pago: pagoInfo } : {}),
          lineas: lineasCreadas,
          data: facturaFinal,
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
          error: 'Error al crear factura de proveedor',
          message: errorMessage,
          details: axiosError?.response?.data || null,
        }, null, 2),
      }],
      isError: true,
    };
  }
}