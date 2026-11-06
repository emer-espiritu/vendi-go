import { zodResolver } from "@hookform/resolvers/zod";
import {
  Barcode,
  CircleDollarSign,
  ImagePlus,
  LayoutGrid,
  List,
  Package,
  Pencil,
  Plus,
  ScanLine,
  Sparkles,
  Tags,
  Trash2,
  TriangleAlert,
  Loader2,
  X,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Presentation, Product } from "@/types";
import { useDemoStore } from "@/store/demo-store";
import { useScannerWedge } from "@/hooks/use-scanner-wedge";
import { useToast } from "@/store/toast";
import { messageOf } from "@/services/errors";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { compressProductImage } from "@/lib/image";
import {
  BASE_UNIT_LABELS,
  PURCHASE_UNIT_LABELS,
  buildPresentations,
} from "@/lib/presentations";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  SegmentedControl,
  Select,
  StatCard,
  Switch,
} from "@/components/ui";
import type { BadgeTone, Column } from "@/components/ui";

/** Cámara lectora de códigos (chunk separado: solo se descarga al usarla). */
const ScannerModal = lazy(() => import("@/components/scanner/scanner-modal"));

const SKU_PATTERN = /^[A-Z]{3}-[A-Z]{3}-[0-9]{3,4}$/;
const BARCODE_PATTERN = /^\d{8,14}$/;

const BASE_UNIT_OPTIONS = ["und", "kg", "lt", "ml", "g"] as const;
const PURCHASE_UNIT_OPTIONS = ["caja", "saco", "bolsa", "paquete"] as const;

type StatusFilter = "todos" | "activos" | "inactivos";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "activos", label: "Activos" },
  { value: "inactivos", label: "Inactivos" },
];

const VIEW_OPTIONS = [
  { value: "grid", label: "Vista de cuadrícula", icon: LayoutGrid },
  { value: "table", label: "Vista de tabla", icon: List },
] as const;

const presentationSchema = z.object({
  id: z.string().min(1),
  label: z
    .string()
    .trim()
    .min(1, "La etiqueta de la presentación es obligatoria."),
  factor: z
    .number({
      error: "Ingresa cuántas unidades base contiene la presentación.",
    })
    .positive("La equivalencia debe ser mayor a cero."),
  price: z
    .number({ error: "Ingresa un precio de presentación válido." })
    .min(0.01, "El precio de la presentación debe ser mayor a cero."),
  barcode: z
    .string()
    .trim()
    .regex(
      BARCODE_PATTERN,
      "El código de barras debe contener entre 8 y 14 dígitos numéricos.",
    )
    .or(z.literal(""))
    .optional(),
});

const productSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "El nombre del producto debe tener al menos 3 caracteres."),
    sku: z
      .string()
      .trim()
      .min(1, "Ingresa el SKU del producto.")
      .toUpperCase()
      .regex(
        SKU_PATTERN,
        "El SKU debe tener el formato AAA-AAA-000, por ejemplo ABA-ARZ-005.",
      ),
    barcode: z
      .string()
      .trim()
      .regex(
        BARCODE_PATTERN,
        "El código de barras debe contener entre 8 y 14 dígitos numéricos.",
      ),
    categoryId: z.string().min(1, "Selecciona una categoría para el producto."),
    price: z
      .number({ error: "Ingresa un precio de venta válido." })
      .positive("El precio de venta debe ser mayor a cero."),
    cost: z
      .number({ error: "Ingresa un costo válido." })
      .min(0, "El costo no puede ser negativo."),
    stock: z
      .number({ error: "Ingresa un stock válido." })
      .min(0, "El stock no puede ser negativo."),
    minStock: z
      .number({ error: "Ingresa un stock mínimo válido." })
      .min(0, "El stock mínimo no puede ser negativo."),
    baseUnit: z.enum(BASE_UNIT_OPTIONS),
    purchaseUnit: z.enum(["", ...PURCHASE_UNIT_OPTIONS]),
    packSize: z
      .number({
        error: "Ingresa cuántas unidades base trae la unidad de compra.",
      })
      .min(1, "El pack debe contener al menos 1 unidad base."),
    presentations: z
      .array(presentationSchema)
      .min(1, "Agrega al menos la presentación base."),
    expiresAt: z.string().optional(),
    supplierId: z.string().optional(),
    active: z.boolean(),
    image: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (
      !values.presentations.some((presentation) => presentation.factor === 1)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["presentations"],
        message: "Debe existir la presentación base (equivalencia 1).",
      });
    }
    if (values.purchaseUnit && values.packSize < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["packSize"],
        message: "Una unidad de compra debe contener al menos 2 unidades base.",
      });
    }
  });

type ProductFormValues = z.infer<typeof productSchema>;

const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "El nombre de la categoría debe tener al menos 3 caracteres."),
  emoji: z
    .string()
    .trim()
    .min(1, "Ingresa un emoji representativo para la categoría.")
    .max(4, "Usa un máximo de 4 caracteres para el emoji."),
  color: z
    .string()
    .regex(
      /^#[0-9a-fA-F]{6}$/,
      "Selecciona un color válido en formato hexadecimal.",
    ),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

function emptyProductValues(categoryId: string): ProductFormValues {
  return {
    name: "",
    sku: "",
    barcode: "",
    categoryId,
    price: 0,
    cost: 0,
    stock: 0,
    minStock: 0,
    baseUnit: "und",
    purchaseUnit: "",
    packSize: 1,
    presentations: buildPresentations({ baseUnit: "und", basePrice: 0 }).map(
      (presentation) => ({
        ...presentation,
        barcode: "",
      }),
    ),
    expiresAt: "",
    supplierId: "",
    active: true,
    image: "",
  };
}

function productToValues(product: Product): ProductFormValues {
  return {
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    categoryId: product.categoryId,
    price: product.price,
    cost: product.cost,
    stock: product.stock,
    minStock: product.minStock,
    baseUnit: product.baseUnit,
    purchaseUnit: product.purchaseUnit ?? "",
    packSize: product.packSize ?? 1,
    presentations: product.presentations.map((presentation) => ({
      ...presentation,
      barcode: presentation.barcode ?? "",
    })),
    expiresAt: product.expiresAt ?? "",
    supplierId: product.supplierId ?? "",
    active: product.active,
    image: product.image ?? "",
  };
}

function stockStatus(product: Product): { label: string; tone: BadgeTone } {
  if (product.stock === 0) return { label: "Agotado", tone: "danger" };
  if (product.stock <= product.minStock)
    return { label: "Bajo", tone: "warning" };
  return { label: "Ok", tone: "success" };
}

function marginOf(product: Product) {
  return product.price > 0
    ? ((product.price - product.cost) / product.price) * 100
    : 0;
}

function skuToken(value: string) {
  const cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  return `${cleaned}XXX`.slice(0, 3);
}

function ProductThumb({
  product,
  color,
  className,
}: {
  product: Product;
  color?: string;
  className?: string;
}) {
  const baseColor = color ?? "#64748b";
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border text-lg",
        className,
      )}
      style={{
        backgroundColor: `${baseColor}1a`,
        borderColor: `${baseColor}33`,
      }}
    >
      {product.image ? (
        <img
          src={product.image}
          alt={product.name}
          className="size-10 object-contain"
        />
      ) : (
        <span aria-hidden="true">{product.emoji}</span>
      )}
    </span>
  );
}

export default function ProductsPage() {
  const {
    products,
    categories,
    suppliers,
    createProduct,
    updateProduct,
    deleteProduct,
    addCategory,
  } = useDemoStore();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  // Estado visible del pipeline de imagen: el paso exacto se muestra en el
  // botón ("Subir imagen" → "decodificada" → "comprimida"), así el paso en
  // que traba es visible sin abrir la consola.
  const [imageStep, setImageStep] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: emptyProductValues(""),
  });

  /** Código capturado con cámara o lector; valida en caliente el campo. */
  const putBarcode = (code: string) => {
    const value = code.trim();
    if (!value || !formOpen) return;
    setValue("barcode", value, { shouldValidate: true });
  };

  /** Lector USB con foco fuera del formulario: solo se captura con form abierta. */
  useScannerWedge({
    enabled: formOpen && !scanOpen && !deleteTarget && !categoryOpen,
    onScan: putBarcode,
  });

  const values = watch();
  const selectedCategory = categories.find(
    (category) => category.id === values.categoryId,
  );
  const liveMargin =
    Number.isFinite(values.price) &&
    Number.isFinite(values.cost) &&
    values.price > 0
      ? ((values.price - values.cost) / values.price) * 100
      : 0;
  const previewColor = selectedCategory?.color ?? "#64748b";

  const {
    register: registerCategory,
    handleSubmit: handleCategorySubmit,
    reset: resetCategory,
    watch: watchCategory,
    formState: { errors: categoryErrors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", emoji: "🛒", color: "#0ea5e9" },
  });

  const categoryColorValue = watchCategory("color");

  const stats = useMemo(() => {
    const activeProducts = products.filter((product) => product.active);
    return {
      active: activeProducts.length,
      inactive: products.length - activeProducts.length,
      inventoryValue: products.reduce(
        (total, product) => total + product.cost * product.stock,
        0,
      ),
      lowStock: activeProducts.filter(
        (product) => product.stock <= product.minStock,
      ).length,
      outOfStock: products.filter((product) => product.stock === 0).length,
      categories: categories.length,
    };
  }, [products, categories]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesTerm =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        product.barcode.includes(term);
      const matchesCategory =
        categoryFilter === "all" || product.categoryId === categoryFilter;
      const matchesStatus =
        statusFilter === "todos" ||
        (statusFilter === "activos" ? product.active : !product.active);
      return matchesTerm && matchesCategory && matchesStatus;
    });
  }, [products, search, categoryFilter, statusFilter]);

  const categoryFor = (id: string) =>
    categories.find((category) => category.id === id);
  const colorFor = (id: string) => categoryFor(id)?.color ?? "#64748b";

  const openCreate = () => {
    setEditing(null);
    reset(emptyProductValues(categories[0]?.id ?? ""));
    setFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    reset(productToValues(product));
    setFormOpen(true);
  };

  const closeProductForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const recalculatePresentations = () => {
    const current = values.presentations ?? [];
    const list = buildPresentations({
      baseUnit: values.baseUnit,
      purchaseUnit: values.purchaseUnit || undefined,
      packSize: values.packSize,
      basePrice: values.price,
    }).map((presentation) => ({
      ...presentation,
      barcode:
        current.find((item) => item.id === presentation.id)?.barcode ?? "",
    }));
    setValue("presentations", list, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const openCategory = () => {
    resetCategory({ name: "", emoji: "🛒", color: "#0ea5e9" });
    setCategoryOpen(true);
  };

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("todos");
  };

  const suggestSku = () => {
    const category = categories.find((item) => item.id === values.categoryId);
    const name = values.name.trim();
    if (!category || !name) {
      toast({
        title: "Faltan datos",
        description:
          "Completa el nombre y la categoría para generar una sugerencia de SKU.",
        tone: "warning",
      });
      return;
    }
    const sequence = String(products.length + 1)
      .padStart(3, "0")
      .slice(-4);
    const suggestion = `${skuToken(category.name)}-${skuToken(name)}-${sequence}`;
    setValue("sku", suggestion, { shouldValidate: true, shouldDirty: true });
    toast({
      title: "SKU sugerido",
      description: `Se generó el código ${suggestion}. Puedes editarlo si lo necesitas.`,
      tone: "info",
    });
  };

  /** Núcleo del picker: valida y procesa una imagen sin importar su origen. */

  const processImageFile = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Archivo no compatible",
        description: "Selecciona una imagen PNG, JPG, WebP o GIF.",
        tone: "error",
      });
      return;
    }

    setImageStep("Leyendo archivo…");

    try {
      let imageData: string;

      if (file.type === "image/gif") {
        imageData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("No se pudo leer la imagen GIF."));
            }
          };

          reader.onerror = () => {
            reject(new Error("Error al leer el archivo seleccionado."));
          };

          reader.readAsDataURL(file);
        });
      } else {
        imageData = await compressProductImage(file, (step) => {
          setImageStep(
            step.stage === "procesando"
              ? `Procesando… ${Math.round((step.progress ?? 0) * 100)}%`
              : `Procesando… ${step.elapsedMs} ms`,
          );
        });
      }

      setValue("image", imageData, {
        shouldDirty: true,
        shouldValidate: true,
      });

      toast({
        title: "Imagen cargada",
        description: "La imagen del producto se agregó correctamente.",
        tone: "success",
      });
    } catch (cause: unknown) {
      toast({
        title: "Imagen no procesada",
        description: messageOf(cause),
        tone: "error",
      });
    } finally {
      setImageStep(null);
    }
  };

  const onImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) return;

    // Permite seleccionar nuevamente el mismo archivo.
    input.value = "";

    processImageFile(file);
  };

  /** Vista previa sin diálogo del sistema: soltar el archivo sobre la tarjeta. */
  const onImageDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  };

  const onImageDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  /** Pegar una imagen desde el portapapeles (Ctrl+V) mientras el form está abierto. */
  const pasteHandlerRef = useRef(processImageFile);
  useEffect(() => {
    pasteHandlerRef.current = processImageFile;
  });
  useEffect(() => {
    if (!formOpen) return;
    const onPaste = (event: ClipboardEvent) => {
      const file = event.clipboardData?.files?.[0];
      if (file) {
        event.preventDefault();
        pasteHandlerRef.current(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [formOpen]);

  const onProductSubmit = async (formValues: ProductFormValues) => {
    const category = categories.find(
      (item) => item.id === formValues.categoryId,
    );
    const presentations: Presentation[] = formValues.presentations.map(
      (presentation) => ({
        ...presentation,
        price:
          presentation.factor === 1 ? formValues.price : presentation.price,
        barcode: presentation.barcode || undefined,
      }),
    );
    const base =
      presentations.find((presentation) => presentation.factor === 1) ??
      presentations[0];
    const payload = {
      name: formValues.name.trim(),
      sku: formValues.sku,
      barcode: formValues.barcode,
      categoryId: formValues.categoryId,
      price: base.price,
      cost: formValues.cost,
      stock: formValues.stock,
      minStock: formValues.minStock,
      baseUnit: formValues.baseUnit,
      purchaseUnit: formValues.purchaseUnit || undefined,
      packSize: formValues.purchaseUnit ? formValues.packSize : undefined,
      presentations,
      image: formValues.image || undefined,
      emoji: editing?.emoji ?? category?.emoji ?? "📦",
      expiresAt: formValues.expiresAt || undefined,
      supplierId: formValues.supplierId || undefined,
      active: formValues.active,
    };

    try {
      if (editing) {
        await updateProduct(editing.id, payload);
        toast({
          title: "Producto actualizado",
          description: `${payload.name} se actualizó correctamente en el catálogo.`,
          tone: "success",
        });
      } else {
        await createProduct(payload);
        toast({
          title: "Producto creado",
          description: `${payload.name} ya forma parte del catálogo.`,
          tone: "success",
        });
      }
      closeProductForm();
    } catch (cause) {
      toast({
        title: "No se pudo guardar el producto",
        description: messageOf(cause),
        tone: "error",
      });
    }
  };

  const onCategorySubmit = async (formValues: CategoryFormValues) => {
    try {
      await addCategory(
        formValues.name.trim(),
        formValues.emoji.trim(),
        formValues.color,
      );
      toast({
        title: "Categoría creada",
        description: `La categoría ${formValues.name.trim()} ya está disponible para asignar productos.`,
        tone: "success",
      });
      resetCategory();
      setCategoryOpen(false);
    } catch (cause) {
      toast({
        title: "No se pudo crear la categoría",
        description: messageOf(cause),
        tone: "error",
      });
    }
  };

  const columns: Column<Product>[] = [
    {
      key: "product",
      header: "Producto",
      sortValue: (product) => product.name,
      render: (product) => (
        <div className="flex items-center gap-2.5">
          <ProductThumb
            product={product}
            color={colorFor(product.categoryId)}
          />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">
              {product.name}
            </p>
            <p className="truncate font-mono text-[10px] text-muted">
              {product.sku}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Categoría",
      sortValue: (product) => categoryFor(product.categoryId)?.name ?? "",
      render: (product) => {
        const category = categoryFor(product.categoryId);
        return (
          <Badge tone="neutral">
            <span aria-hidden="true">{category?.emoji ?? "📦"}</span>
            {category?.name ?? "Sin categoría"}
          </Badge>
        );
      },
    },
    {
      key: "barcode",
      header: "SKU / código",
      sortValue: (product) => product.barcode,
      render: (product) => (
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold text-foreground">
            {product.sku}
          </p>
          <p className="font-mono text-[10px] text-muted">{product.barcode}</p>
        </div>
      ),
    },
    {
      key: "price",
      header: "Precio",
      align: "right",
      sortValue: (product) => product.price,
      render: (product) => (
        <span className="text-xs font-semibold text-foreground">
          {formatCurrency(product.price)}
        </span>
      ),
    },
    {
      key: "cost",
      header: "Costo",
      align: "right",
      sortValue: (product) => product.cost,
      render: (product) => (
        <span className="text-xs text-muted">
          {formatCurrency(product.cost)}
        </span>
      ),
    },
    {
      key: "margin",
      header: "Margen",
      align: "right",
      sortValue: (product) => marginOf(product),
      render: (product) => {
        const margin = marginOf(product);
        const tone: BadgeTone =
          margin >= 30 ? "success" : margin >= 15 ? "warning" : "danger";
        return <Badge tone={tone}>{margin.toFixed(1)}%</Badge>;
      },
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      sortValue: (product) => product.stock,
      render: (product) => {
        const status = stockStatus(product);
        return (
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-semibold text-foreground">
              {formatNumber(product.stock, 2)}{" "}
              {BASE_UNIT_LABELS[product.baseUnit]}
            </span>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
        );
      },
    },
    {
      key: "state",
      header: "Estado",
      sortValue: (product) => Number(product.active),
      render: (product) => (
        <Badge tone={product.active ? "success" : "neutral"}>
          {product.active ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      render: (product) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Editar ${product.name}`}
            onClick={() => openEdit(product)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Eliminar ${product.name}`}
            onClick={() => setDeleteTarget(product)}
          >
            <Trash2 className="size-4 text-danger" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Package}
        eyebrow="Catálogo"
        title="Productos"
        description="Administra precios, costos, códigos y categorías del catálogo del minimarket."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Tags className="size-4" />}
              onClick={openCategory}
            >
              Nueva categoría
            </Button>
            <Button icon={<Plus className="size-4" />} onClick={openCreate}>
              Nuevo producto
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Productos activos"
          value={formatNumber(stats.active)}
          icon={Package}
          tone="brand"
          hint={`${formatNumber(stats.inactive)} inactivos`}
        />
        <StatCard
          label="Valor del inventario"
          value={formatCurrency(stats.inventoryValue)}
          icon={CircleDollarSign}
          tone="success"
          hint="Stock valorizado a costo"
        />
        <StatCard
          label="Bajo stock mínimo"
          value={formatNumber(stats.lowStock)}
          icon={TriangleAlert}
          tone="warning"
          hint={`${formatNumber(stats.outOfStock)} productos agotados`}
        />
        <StatCard
          label="Categorías"
          value={formatNumber(stats.categories)}
          icon={Tags}
          tone="violet"
          hint="Categorías registradas"
        />
      </div>

      <Card className="p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Buscar por nombre, SKU o código de barras..."
            className="lg:max-w-sm"
          />
          <Select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label="Filtrar por categoría"
            className="lg:w-52"
          >
            <option value="all">Todas las categorías</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.emoji} {category.name}
              </option>
            ))}
          </Select>
          <SegmentedControl
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <div className="flex items-center gap-2 lg:ml-auto">
            <div className="inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface-2 p-0.5">
              {VIEW_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = view === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setView(option.value)}
                    aria-pressed={active}
                    aria-label={option.label}
                    title={option.label}
                    className={cn(
                      "grid size-8 place-items-center rounded-[0.6rem] transition-all duration-200",
                      active
                        ? "bg-brand-500 text-brand-950 shadow-sm"
                        : "text-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                );
              })}
            </div>
            <Badge tone="neutral">
              {formatNumber(filtered.length)} productos
            </Badge>
          </div>
        </div>
      </Card>

      {view === "grid" ? (
        filtered.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((product) => {
              const category = categoryFor(product.categoryId);
              const status = stockStatus(product);
              const margin = marginOf(product);
              return (
                <Card
                  key={product.id}
                  className="group flex flex-col p-4 animate-fade-up hover:border-brand/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                      <ProductThumb
                        product={product}
                        color={category?.color}
                        className="size-14 text-2xl"
                      />
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold text-foreground">
                          {product.name}
                        </p>
                        <p className="mt-1 truncate font-mono text-[10px] text-muted">
                          {product.sku}
                        </p>
                        <p className="truncate font-mono text-[10px] text-muted">
                          {product.barcode || "Sin código de barras"}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${product.name}`}
                        onClick={() => openEdit(product)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Eliminar ${product.name}`}
                        onClick={() => setDeleteTarget(product)}
                      >
                        <Trash2 className="size-4 text-danger" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral">
                      <span aria-hidden="true">{category?.emoji ?? "📦"}</span>
                      {category?.name ?? "Sin categoría"}
                    </Badge>
                    {!product.active ? (
                      <Badge tone="neutral">Inactivo</Badge>
                    ) : null}
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {product.presentations.length > 1 ? (
                      <Badge tone="brand">
                        {product.presentations.length} presentaciones
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Precio
                      </p>
                      <p className="text-lg font-semibold tracking-tight text-foreground">
                        {formatCurrency(product.price)}
                        <span className="ml-1 text-[10px] font-normal text-muted">
                          / {BASE_UNIT_LABELS[product.baseUnit]}
                        </span>
                      </p>
                      <p className="text-[10px] text-muted">
                        Costo {formatCurrency(product.cost)} · margen{" "}
                        {margin.toFixed(1)}%
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-foreground">
                        {formatNumber(product.stock, 2)}{" "}
                        {BASE_UNIT_LABELS[product.baseUnit]}
                      </p>
                      <p className="text-[10px] text-muted">
                        Mín. {formatNumber(product.minStock, 2)}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Package}
            title={
              products.length === 0 ? "Aún no hay productos" : "Sin resultados"
            }
            description={
              products.length === 0
                ? "Registra tu primer producto para comenzar a construir el catálogo del minimarket."
                : "No encontramos productos con esos filtros. Ajusta la búsqueda o restablece los filtros."
            }
            action={
              products.length === 0 ? (
                <Button icon={<Plus className="size-4" />} onClick={openCreate}>
                  Nuevo producto
                </Button>
              ) : (
                <Button variant="secondary" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )
            }
          />
        )
      ) : (
        <Card>
          <DataTable
            columns={columns}
            data={filtered}
            keyField={(product) => product.id}
            pageSize={8}
            emptyTitle="Sin productos"
            emptyDescription="No encontramos productos con los filtros seleccionados. Ajusta la búsqueda o registra uno nuevo."
          />
        </Card>
      )}

      <Modal
        open={formOpen}
        onClose={closeProductForm}
        title={editing ? "Editar producto" : "Nuevo producto"}
        description={
          editing
            ? "Actualiza los datos comerciales y de inventario del producto."
            : "Registra un producto con su información comercial, stock y código de barras."
        }
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              type="button"
              onClick={closeProductForm}
            >
              Cancelar
            </Button>
            <Button type="submit" form="product-form">
              {editing ? "Guardar cambios" : "Crear producto"}
            </Button>
          </>
        }
      >
        <form
          id="product-form"
          onSubmit={handleSubmit(onProductSubmit)}
          className="space-y-4"
          noValidate
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Nombre del producto"
              required
              error={errors.name?.message}
              className="sm:col-span-2"
            >
              <Input
                {...register("name")}
                placeholder="Ej. Arroz Costeño Extra 5 kg"
                invalid={Boolean(errors.name)}
              />
            </Field>

            <Field
              label="SKU"
              required
              error={errors.sku?.message}
              hint="Formato AAA-AAA-000. Puedes generarlo desde la categoría y el nombre."
            >
              <div className="flex gap-2">
                <Input
                  {...register("sku")}
                  placeholder="ABA-ARZ-005"
                  className="font-mono uppercase"
                  invalid={Boolean(errors.sku)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Sparkles className="size-4" />}
                  onClick={suggestSku}
                  className="shrink-0"
                >
                  Sugerir
                </Button>
              </div>
            </Field>

            <Field
              label="Código de barras"
              required
              error={errors.barcode?.message}
            >
              <div className="flex items-center gap-2">
                <Input
                  {...register("barcode")}
                  inputMode="numeric"
                  placeholder="7750182001234"
                  icon={<Barcode className="size-4" />}
                  invalid={Boolean(errors.barcode)}
                  className="flex-1"
                  type="text"
                  /* El lector tipea el código y lanza Enter: no debe submittear el form */
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="shrink-0"
                  title="Escanear con la cámara"
                  aria-label="Escanear código de barras con la cámara"
                  onClick={() => setScanOpen(true)}
                >
                  <ScanLine className="size-4" />
                </Button>
              </div>
            </Field>

            <Field
              label="Categoría"
              required
              error={errors.categoryId?.message}
            >
              <Select
                {...register("categoryId")}
                invalid={Boolean(errors.categoryId)}
              >
                <option value="">Selecciona una categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.emoji} {category.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Proveedor"
              hint="Opcional. Asocia el producto a un proveedor registrado."
            >
              <Select {...register("supplierId")}>
                <option value="">Sin proveedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={`Precio de venta por ${BASE_UNIT_LABELS[values.baseUnit]} (S/)`}
              required
              error={errors.price?.message}
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register("price", { valueAsNumber: true })}
                invalid={Boolean(errors.price)}
              />
            </Field>

            <Field label="Costo (S/)" required error={errors.cost?.message}>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register("cost", { valueAsNumber: true })}
                invalid={Boolean(errors.cost)}
              />
            </Field>

            <Field label="Stock actual" required error={errors.stock?.message}>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register("stock", { valueAsNumber: true })}
                invalid={Boolean(errors.stock)}
              />
            </Field>

            <Field
              label="Stock mínimo"
              required
              error={errors.minStock?.message}
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register("minStock", { valueAsNumber: true })}
                invalid={Boolean(errors.minStock)}
              />
            </Field>

            <Field
              label="Unidad base"
              required
              error={errors.baseUnit?.message}
              hint="El stock, los mínimos y las conversiones se manejan en esta unidad."
            >
              <Select
                {...register("baseUnit")}
                invalid={Boolean(errors.baseUnit)}
              >
                {BASE_UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>
                    {BASE_UNIT_LABELS[unit]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Unidad de compra"
              hint="Opcional. Permite vender el producto por caja, saco, bolsa o paquete."
            >
              <Select {...register("purchaseUnit")}>
                <option value="">Sin unidad de compra</option>
                {PURCHASE_UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>
                    {PURCHASE_UNIT_LABELS[unit]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Unidades base por unidad de compra"
              error={errors.packSize?.message}
              hint={`Ej.: 1 CAJA = 12 ${BASE_UNIT_LABELS[values.baseUnit]} o 1 SACO = 50 ${BASE_UNIT_LABELS[values.baseUnit]}.`}
            >
              <Input
                type="number"
                step="0.01"
                min="1"
                disabled={!values.purchaseUnit}
                {...register("packSize", { valueAsNumber: true })}
                invalid={Boolean(errors.packSize)}
              />
            </Field>

            <div className="space-y-2 rounded-xl border border-line bg-surface-2/60 p-3 sm:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Presentaciones de venta
                  </p>
                  <p className="text-[10px] text-muted">
                    Equivalencias en {BASE_UNIT_LABELS[values.baseUnit]}. El
                    stock se descuenta automáticamente en la unidad base.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Sparkles className="size-4" />}
                  onClick={recalculatePresentations}
                >
                  Recalcular precios
                </Button>
              </div>

              <div className="hidden gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted sm:grid sm:grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_minmax(0,1fr)]">
                <span>Presentación</span>
                <span>Contiene</span>
                <span>Precio</span>
                <span>Código</span>
              </div>

              <div className="space-y-2">
                {(values.presentations ?? []).map((presentation, index) => (
                  <div
                    key={`${presentation.id}-${index}`}
                    className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface p-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_minmax(0,1fr)] sm:border-0 sm:bg-transparent sm:p-0"
                  >
                    <Input
                      {...register(`presentations.${index}.label`)}
                      aria-label={`Etiqueta de la presentación ${index + 1}`}
                      invalid={Boolean(errors.presentations?.[index]?.label)}
                      className="h-8 text-xs"
                    />
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        disabled={presentation.factor === 1}
                        {...register(`presentations.${index}.factor`, {
                          valueAsNumber: true,
                        })}
                        aria-label={`Equivalencia de la presentación ${presentation.label}`}
                        invalid={Boolean(errors.presentations?.[index]?.factor)}
                        className="h-8 pr-9 text-xs"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted">
                        {BASE_UNIT_LABELS[values.baseUnit]}
                      </span>
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">
                        S/
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        disabled={presentation.factor === 1}
                        {...register(`presentations.${index}.price`, {
                          valueAsNumber: true,
                        })}
                        aria-label={`Precio de la presentación ${presentation.label}`}
                        invalid={Boolean(errors.presentations?.[index]?.price)}
                        className="h-8 pl-6 text-xs"
                      />
                    </div>
                    <Input
                      {...register(`presentations.${index}.barcode`)}
                      placeholder="Código opcional"
                      aria-label={`Código de barras de la presentación ${presentation.label}`}
                      invalid={Boolean(errors.presentations?.[index]?.barcode)}
                      className="h-8 text-xs"
                      /* Enter del lector no debe submittear el form */
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.preventDefault();
                      }}
                    />
                  </div>
                ))}
              </div>

              {errors.presentations?.message ? (
                <p className="text-[11px] font-medium text-danger">
                  {errors.presentations.message}
                </p>
              ) : null}
              <p className="text-[10px] text-muted">
                La presentación base (equivalencia 1) toma el precio de venta
                por unidad base del producto.
              </p>
            </div>

            <Field
              label="Fecha de vencimiento"
              hint="Opcional. Se usa para las alertas de vencimiento."
            >
              <Input type="date" {...register("expiresAt")} />
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
            <Switch
              checked={values.active}
              onCheckedChange={(checked) =>
                setValue("active", checked, { shouldDirty: true })
              }
              label="Producto activo"
              description="Visible y disponible para la venta en el punto de caja."
            />
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Margen estimado
              </p>
              <p
                className={cn(
                  "text-sm font-semibold",
                  liveMargin >= 0 ? "text-success" : "text-danger",
                )}
              >
                {liveMargin.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted">
                Utilidad{" "}
                {formatCurrency(Math.max(0, values.price - values.cost))} por{" "}
                {BASE_UNIT_LABELS[values.baseUnit]}
              </p>
            </div>
          </div>

          <Field
            label="Imagen del producto"
            hint="Arrastra una imagen, pégala con Ctrl+V o selecciónala desde tu dispositivo."
            className="sm:col-span-2"
          >
            <div
              className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-line bg-surface-2/60 p-3"
              onDrop={onImageDrop}
              onDragOver={onImageDragOver}
            >
              {/* Vista previa */}
              <span
                className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border text-2xl"
                style={{
                  backgroundColor: `${previewColor}1a`,
                  borderColor: `${previewColor}33`,
                }}
                aria-busy={Boolean(imageStep)}
              >
                {values.image ? (
                  <img
                    src={values.image}
                    alt="Vista previa del producto"
                    decoding="async"
                    className="size-20 object-contain"
                  />
                ) : (
                  <span aria-hidden="true">
                    {selectedCategory?.emoji ?? "📦"}
                  </span>
                )}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {/* Input real, controlado mediante referencia */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  disabled={Boolean(imageStep)}
                  onChange={onImageChange}
                />

                {/* Botón que abre el explorador */}
                <button
                  type="button"
                  disabled={Boolean(imageStep)}
                  onClick={() => imageInputRef.current?.click()}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold transition",
                    "hover:border-brand/40 hover:bg-surface-3",
                    "disabled:pointer-events-none disabled:opacity-60",
                  )}
                >
                  {imageStep ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ImagePlus className="size-4" />
                  )}

                  {imageStep ?? "Subir imagen"}
                </button>

                {values.image && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<X className="size-4" />}
                    onClick={() =>
                      setValue("image", "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    Quitar
                  </Button>
                )}
              </div>
            </div>
          </Field>
        </form>
      </Modal>

      <Modal
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        title="Nueva categoría"
        description="Agrega una categoría para organizar el catálogo y los reportes."
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setCategoryOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" form="category-form">
              Crear categoría
            </Button>
          </>
        }
      >
        <form
          id="category-form"
          onSubmit={handleCategorySubmit(onCategorySubmit)}
          className="space-y-4"
          noValidate
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Nombre"
              required
              error={categoryErrors.name?.message}
              className="sm:col-span-2"
            >
              <Input
                {...registerCategory("name")}
                placeholder="Ej. Congelados"
                invalid={Boolean(categoryErrors.name)}
              />
            </Field>

            <Field
              label="Emoji"
              required
              error={categoryErrors.emoji?.message}
              hint="Se usa como ícono en el catálogo."
            >
              <Input
                {...registerCategory("emoji")}
                maxLength={4}
                placeholder="🧊"
                invalid={Boolean(categoryErrors.emoji)}
              />
            </Field>

            <Field
              label="Color"
              required
              error={categoryErrors.color?.message}
              hint="Se usa en gráficos y reportes."
            >
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  className="h-10 w-16 cursor-pointer p-1"
                  {...registerCategory("color")}
                  invalid={Boolean(categoryErrors.color)}
                />
                <span className="font-mono text-xs font-semibold uppercase text-foreground">
                  {categoryColorValue}
                </span>
              </div>
            </Field>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Categorías registradas
            </p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-2.5 py-2"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-base">
                    {category.emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                    {category.name}
                  </span>
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const target = deleteTarget;
          setDeleteTarget(null);
          try {
            await deleteProduct(target.id);
            toast({
              title: "Producto eliminado",
              description: `${target.name} se retiró del catálogo.`,
              tone: "success",
            });
          } catch (cause) {
            toast({
              title: "No se pudo eliminar el producto",
              description: messageOf(cause),
              tone: "error",
            });
          }
        }}
        title="Eliminar producto"
        description={
          deleteTarget
            ? `¿Confirmas eliminar ${deleteTarget.name} del catálogo? Esta acción no se puede deshacer.`
            : ""
        }
      />

      {scanOpen ? (
        <Suspense fallback={null}>
          <ScannerModal
            open={scanOpen}
            onClose={() => setScanOpen(false)}
            onScan={putBarcode}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
