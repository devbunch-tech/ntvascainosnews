import { Product } from "../../models/Product.js";
import { Event } from "../../models/Event.js";
import { requirePermission } from "../../lib/auth.js";
import { idField, type GraphQLContext } from "../../lib/context.js";

type ProductFilter = {
  category?: string;
  marketplace?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  includeHidden?: boolean;
};

const SORTS: Record<string, Record<string, 1 | -1>> = {
  recent: { highlighted: -1, createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  title: { title: 1 },
};

function buildQuery(filter: ProductFilter = {}, isStaff = false) {
  const q: Record<string, unknown> = {};
  if (!(filter.includeHidden && isStaff)) q.visible = true;
  if (filter.category) q.category = filter.category;
  if (filter.marketplace) q.marketplace = filter.marketplace;
  if (filter.search) q.title = { $regex: filter.search, $options: "i" };
  if (filter.minPrice != null || filter.maxPrice != null) {
    const range: Record<string, number> = {};
    if (filter.minPrice != null) range.$gte = filter.minPrice;
    if (filter.maxPrice != null) range.$lte = filter.maxPrice;
    q.price = range;
  }
  return q;
}

export const productResolvers = {
  Query: {
    products: async (
      _: unknown,
      {
        filter,
        sort = "recent",
        limit = 12,
        offset = 0,
      }: { filter?: ProductFilter; sort?: string; limit?: number; offset?: number },
      ctx: GraphQLContext,
    ) => {
      const isStaff = ctx.user?.role === "admin" || ctx.user?.role === "editor";
      const q = buildQuery(filter, isStaff);
      // Facetas ignoram o próprio filtro de categoria para as contagens seguirem visíveis.
      const facetBase = buildQuery({ ...filter, category: undefined, marketplace: undefined }, isStaff);

      const [items, total, categories, marketplaces, range] = await Promise.all([
        Product.find(q).sort(SORTS[sort] ?? SORTS.recent).skip(offset).limit(Math.min(limit, 60)).lean(),
        Product.countDocuments(q),
        Product.aggregate([
          { $match: facetBase },
          { $group: { _id: "$category", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Product.aggregate([
          { $match: facetBase },
          { $group: { _id: "$marketplace", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Product.aggregate([
          { $match: { visible: true } },
          { $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } },
        ]),
      ]);

      return {
        items,
        total,
        hasMore: offset + items.length < total,
        categories: categories.filter((c) => c._id).map((c) => ({ value: c._id, count: c.count })),
        marketplaces: marketplaces.filter((m) => m._id).map((m) => ({ value: m._id, count: m.count })),
        priceRange: { min: range[0]?.min ?? 0, max: range[0]?.max ?? 0 },
      };
    },
  },

  Mutation: {
    createProduct: async (_: unknown, { input }: { input: any }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "products:manage");
      return (await Product.create(input)).toObject();
    },
    updateProduct: async (_: unknown, { id, input }: { id: string; input: any }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "products:manage");
      return Product.findByIdAndUpdate(id, { $set: input }, { new: true }).lean();
    },
    deleteProduct: async (_: unknown, { id }: { id: string }, ctx: GraphQLContext) => {
      requirePermission(ctx.user, "products:manage");
      await Product.findByIdAndDelete(id);
      return true;
    },
    trackProductClick: async (_: unknown, { id }: { id: string }) => {
      await Promise.all([
        Product.findByIdAndUpdate(id, { $inc: { clicks: 1 } }),
        Event.create({ type: "shop_click", ref: id }),
      ]);
      return true;
    },
  },

  Product: { id: idField },
};
