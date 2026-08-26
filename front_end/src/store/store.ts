import { configureStore } from '@reduxjs/toolkit';
import boxReducer from '../features/board/boxSlice';
import boardReducer from '../features/board/boardSlice';

export const store = configureStore({
  reducer: {
    box: boxReducer,
    board: boardReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
