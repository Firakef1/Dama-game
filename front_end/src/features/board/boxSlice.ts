import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface BoxState {
    value: number;
}

const initialState: BoxState = {
    value: 0,
};

const boxSlice = createSlice({
    name: 'box',
    initialState,
    reducers: {
        toggle: (state) => {
            state.value = state.value === 0 ? 1 : 0;
        },
        setBoxState: (state, action: PayloadAction<number>) => {
            state.value = action.payload;
        }
    },
});

export const { toggle, setBoxState } = boxSlice.actions;
export default boxSlice.reducer;