import { color_data_collection } from '../app.js';
import {
  LIMIT_SIZE,
  MAX_LIMIT,
} from '../constants.js';

export const getData = async (req, res, next) => {
  try {
    // Reading all query variables given by the user
    const query = req.query;
    const sort = query.sort ? query.sort : null;
    const order = sort && query.order ? query.order : 1;
    let limit = query.limit ? query.limit : LIMIT_SIZE;
    const filterBy = query.filterBy ? query.filterBy : null;
    const filter = filterBy && query.filter ? query.filter : null;
    let skip = query.skip ? query.skip : 0;

    // Permissible filterBy & sort values
    const available_filters = ['collection_name'];
    const available_sorters = ['index', 'token_id'];

    // Error handling for incorrect inputs in query
    if (filterBy && !available_filters.includes(filterBy)) throw new Error('entered \'filter by\' is not supported');
    if (filterBy && !filter) throw new Error('filter not provided');
    if (sort && !available_sorters.includes(sort)) throw new Error('entered \'sorter\' is not supported');
    if (order && (order !== 1 && order !== -1)) throw new Error('order given is not valid')
    if (limit && isNaN(parseInt(limit))) throw new Error('invalid limit');
    if (skip && isNaN(parseInt(skip))) throw new Error('invalid skip');

    // Convert limit & skip to number
    limit = parseInt(limit);
    skip = parseInt(skip);

    // Check max limit that is permissible
    if (limit > MAX_LIMIT) throw new Error('Exceeded maximum limit');
    if (skip < 0) throw new Error('Exceeded minimum skip');

    const aggregateQuery = [];

    if (filterBy) {
      if (filterBy === available_filters[0]) aggregateQuery.push({ $match: { 'collectionName' : filter } });
    }

    if (sort) {
      if (sort === available_sorters[0]) aggregateQuery.push({ $sort: { 'index': order } });
      else if (sort === available_sorters[1]) aggregateQuery.push({ $sort: { 'tokenId': order } });
    }

    aggregateQuery.push({ $skip: skip });
    aggregateQuery.push({ $limit: limit });

    const data = await color_data_collection.aggregate(aggregateQuery, { allowDiskUse: true }).toArray();
    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    // console.log(error.message);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}