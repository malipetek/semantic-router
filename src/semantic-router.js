import EventEmitter from 'events';
import { EmbeddingModel, FlagEmbedding } from "fastembed";
/**
 * @typedef {{ name: string, documents: string[], callback: Function, definitionVectors: Float32Array[] }} Route
*/

  /**
   * Calculates the similarity between the query vector and the index vectors.
   *
   * @param {Float32Array} xq - The query vector
   * @param {Float32Array[]} index - The array dxszawof index vectors
   * @return {Number} The maximum similarity score
   */
  function similarity(xq, index) {
    const indexNorm = index.map(vec => Math.sqrt(vec.reduce((sum, val) => sum + val ** 2, 0)));
    const xqNorm = Math.sqrt(xq.reduce((sum, val) => sum + val ** 2, 0));
    const sim = index.map((vec, i) => vec.reduce((sum, val, i) => sum + val * xq[i], 0) / (indexNorm[i] * xqNorm));
    return Math.max(...sim); // Return the maximum similarity score
  }

const EMITTER = new EventEmitter();
export class SemanticRouter {
  constructor({ fastEmbedOptions } = {}) {
    fastEmbedOptions = {
      model: EmbeddingModel.BGESmallENV15,
      showDownloadProgress: true,
      ...fastEmbedOptions
    }

    /** @type {FlagEmbedding} */
    this.model;
    this.loaded = false;
    /** @type {Route[]} */
    this.routes = [];

    FlagEmbedding.init(fastEmbedOptions).then(
      /** @type {FlagEmbedding} */
      model => {
      this.model = model;
      this.loaded = true;
      EMITTER.emit('model-loaded');
    });
  }

  /**
   * Waits for the model to be loaded and resolves with the model.
   *
   * @return {Promise<FlagEmbedding>} A promise that resolves with the loaded model.
   */
  waitForModelLoad() {
    return new Promise(resolve => {
      if (this.loaded) {
        resolve(this.model);
      } else {
        EMITTER.on('model-loaded', () => resolve(this.model));
      }
    });
  }

  /**
   * onModelLoaded - A function to register a callback for when the model is loaded.
   *
   * @param {(...args: any[]) => void} callback - The callback function to be executed when the model is loaded.
   * @return {void} 
   */
  onModelLoaded(callback) {
    // make sure callback is a function 
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    EMITTER.prependListener('model-loaded', callback);
  }
  /**
   * Asynchronously embeds the given text using the model after waiting for the model to load.
   *
   * @param {string[]} texts - the text to embed
   * @return {Promise<Float32Array[]>} the embedded result
   */
  async embed(texts) {
    await this.waitForModelLoad();
    const embeddings = this.model.embed(texts);
    const embeddingsRes = [];
    for await (const batch of embeddings) {
      // make sure batch is Float32Array
      embeddingsRes.push(batch);
    }
    /** @type {Float32Array[]} */
    const result = embeddingsRes.flat();
    
    return result;
  }
  
  /**
   * Adds a new route to the routes object.
   *
   * @param {string} name - the name of the route
   * @param {string[]} documents - the documents associated with the route
   * @param {function} callback - the callback function for the route
   * @return {Promise<undefined>} 
   */
  async on(name, documents = [], callback = () => {}) {
    const vector = await this.embed(documents);
    this.routes.push({
      name,
      documents,
      callback,
      definitionVectors: vector,
    });
  }

  /**
   * Asynchronously routes a query to the most similar route.
   *
   * @param {string} query - the query to be routed
   * @return {Promise<any>} the result of the routed query
   */
  async route(query) {
    const queryVector = await this.embed([query]);
    /** @type {number[]} */
    const similarityScores = [];
    for (let index in this.routes) {
      const route = this.routes[index];
      if(!route.definitionVectors) {
        continue;
      }
      const similarityScore = similarity(queryVector[0], route.definitionVectors);
      similarityScores.push(similarityScore);
    }
    const mostSimilarIndex = similarityScores.indexOf(similarityScores.find((x, i) => x === Math.max(...similarityScores)));
    const likelyRoute = this.routes[mostSimilarIndex];
    // if top score has very low score return null
    if (similarityScores[mostSimilarIndex] < 0.1) {
      return null;
    }

    likelyRoute.callback(query);

    return likelyRoute;
  }
}
export default () => new SemanticRouter();