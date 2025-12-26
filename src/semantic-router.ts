import EventEmitter from 'events';
import { EmbeddingModel, FlagEmbedding } from "fastembed";

export interface Route {
  name: string;
  documents: string[];
  callback: (query: string) => void;
  definitionVectors?: Float32Array[];
}

export interface DatabaseOptions {
  save?: (vectors: Float32Array[]) => void;
  query?: (query: string) => string[];
}

export interface SemanticRouterOptions {
  fastEmbedOptions?: any;
  db?: DatabaseOptions;
}

function similarity(xq: Float32Array, index: Float32Array[]): number {
  const indexNorm = index.map(vec => Math.sqrt(vec.reduce((sum, val) => sum + val ** 2, 0)));
  const xqNorm = Math.sqrt(xq.reduce((sum, val) => sum + val ** 2, 0));
  const sim = index.map((vec, i) => vec.reduce((sum, val, idx) => sum + val * xq[idx], 0) / (indexNorm[i] * xqNorm));
  return Math.max(...sim);
}

export class SemanticRouter {
  private model?: FlagEmbedding;
  private loaded = false;
  private routes: Route[] = [];
  private options: SemanticRouterOptions;
  private usedb: boolean;
  private emitter = new EventEmitter();
  private modelPromise: Promise<FlagEmbedding>;

  constructor(options: SemanticRouterOptions = { fastEmbedOptions: {}, db: undefined }) {
    this.options = {
      ...options,
      fastEmbedOptions: {
        model: EmbeddingModel.BGESmallENV15,
        showDownloadProgress: true,
        ...options.fastEmbedOptions
      }
    };
    
    this.usedb = !!(this.options.db && this.options.db.save && this.options.db.query);

    this.modelPromise = FlagEmbedding.init(this.options.fastEmbedOptions).then(model =>
    {
      this.model = model;
      this.loaded = true;
      this.emitter.emit('model-loaded');
      return model;
    });
  }

  waitForModelLoad(): Promise<FlagEmbedding> {
    return this.modelPromise;
  }

  onModelLoaded(callback: (...args: any[]) => void): void {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    if (this.loaded) {
      callback();
    } else {
      this.emitter.prependListener('model-loaded', callback);
    }
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    const model = await this.waitForModelLoad();
    const embeddings = model.embed(texts);
    const result: Float32Array[] = [];
    
    for await (const batch of embeddings) {
      for (const vector of batch) {
        result.push(vector instanceof Float32Array ? vector : new Float32Array(vector));
      }
    }
    
    return result;
  }

  async on(name: string, documents: string[] = [], callback: (query: string) => void = () => {}): Promise<void> {
    const vectors = await this.embed(documents);
    this.routes.push({
      name,
      documents,
      callback,
      definitionVectors: vectors,
    });
  }

  async route(query: string): Promise<Route | null> {
    const queryVectors = await this.embed([query]);
    const queryVector = queryVectors[0];
    
    const similarityScores: number[] = [];
    for (const route of this.routes) {
      if (!route.definitionVectors || route.definitionVectors.length === 0) {
        similarityScores.push(0);
        continue;
      }
      const score = similarity(queryVector, route.definitionVectors);
      similarityScores.push(score);
    }

    if (similarityScores.length === 0) return null;

    const maxScore = Math.max(...similarityScores);
    if (maxScore < 0.1) {
      return null;
    }

    const mostSimilarIndex = similarityScores.indexOf(maxScore);
    const likelyRoute = this.routes[mostSimilarIndex];

    likelyRoute.callback(query);
    return likelyRoute;
  }
}

export const createRouter = (options?: SemanticRouterOptions) => new SemanticRouter(options);
export default createRouter;