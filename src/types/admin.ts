import type { Article, CreateArticleInput, UpdateArticleInput, ArticleStatus } from "./database";
import type {
  Realisation,
  CreateRealisationInput,
  UpdateRealisationInput,
  RealisationStatus,
} from "./database";
import type { AIMemory, CreateAIMemoryInput, AIMemoryType } from "./database";

export type {
  Article,
  CreateArticleInput,
  UpdateArticleInput,
  ArticleStatus,
  Realisation,
  CreateRealisationInput,
  UpdateRealisationInput,
  RealisationStatus,
  AIMemory,
  CreateAIMemoryInput,
  AIMemoryType,
};

export interface ArticleFilters {
  status?: ArticleStatus;
  search?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: "created_at" | "updated_at" | "published_at" | "title";
  sortOrder?: "asc" | "desc";
}

export interface RealisationFilters {
  status?: RealisationStatus;
  search?: string;
  featured?: boolean;
  technologies?: string[];
  page?: number;
  limit?: number;
  sortBy?: "created_at" | "updated_at" | "published_at" | "title" | "sort_order";
  sortOrder?: "asc" | "desc";
}

export interface AIMemoryFilters {
  session_id?: string;
  memory_type?: AIMemoryType;
  key?: string;
  limit?: number;
}

export interface AdminDashboardStats {
  articles: {
    total: number;
    published: number;
    drafts: number;
    archived: number;
  };
  realisations: {
    total: number;
    published: number;
    drafts: number;
    featured: number;
  };
  aiMemory: {
    total: number;
    sessions: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
