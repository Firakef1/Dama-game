import { useAppSelector } from "../../store/hooks";

interface BoxProps {
    /** State of the box: 0 for empty box, 1 for P1 piece, 2 for P2 piece, 3 for P1 King, 4 for P2 King */
    boxState?: number;
    /** Click event handler passed from parent or game controller */
    onClick?: () => void;
    /** Is dark square or light square styling (default false) */
    isDarkSquare?: boolean;
    /** Is this square currently selected */
    isSelected?: boolean;
    /** Is this square a valid target move */
    isValidMove?: boolean;
}

export default function Box({ boxState: propBoxState, onClick, isDarkSquare = false, isSelected = false, isValidMove = false }: BoxProps) {
    const reduxValue = useAppSelector((state) => state.box.value);
    
    // Use passed prop if defined, otherwise fallback to Redux state value
    const currentState = propBoxState !== undefined ? propBoxState : reduxValue;

    const isP1 = currentState === 1 || currentState === 3;
    const isP2 = currentState === 2 || currentState === 4;
    const isKing = currentState === 3 || currentState === 4;

    return (
        <div 
            onClick={onClick}
            className={`
                relative w-11 h-11 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-22 lg:h-22 xl:w-24 xl:h-24 flex items-center justify-center cursor-pointer select-none
                transition-all duration-200 rounded-sm
                ${isDarkSquare 
                    ? 'bg-gradient-to-br from-[#45291a] via-[#331c11] to-[#24130a] border border-[#2b170e]/80 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]' 
                    : 'bg-gradient-to-br from-[#e8d3b5] via-[#dbc09e] to-[#caa780] border border-[#be9a70]/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.3)]'
                }
                ${isSelected ? 'ring-2 ring-amber-400 border-amber-300 z-10' : ''}
                ${isValidMove ? 'ring-2 ring-amber-500/80 bg-amber-900/30' : ''}
            `}
            title={`Box state: ${currentState}`}
        >
            {/* Valid Move Target Highlight Dot */}
            {isValidMove && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 bg-amber-600 rounded-full border border-amber-300 shadow-sm" />
                </div>
            )}

            {/* Player 1 Dama Piece (Carved Red Mahogany Disc) */}
            {isP1 && (
                <div className={`relative w-8 h-8 sm:w-13 sm:h-13 md:w-16 md:h-16 lg:w-18 lg:h-18 xl:w-20 xl:h-20 flex items-center justify-center group transition-transform duration-200 ${isSelected ? '-translate-y-1 scale-105' : ''}`}>
                    {/* Shadow underneath */}
                    <div className="absolute inset-0 rounded-full bg-black/40 translate-y-1" />
                    
                    {/* Main Piece Disc */}
                    <div className={`relative w-full h-full rounded-full bg-gradient-to-b from-[#a32222] via-[#751212] to-[#420808] p-[2px] sm:p-[3px] shadow-[0_3px_5px_rgba(0,0,0,0.5)] ${isKing ? 'border-2 border-amber-400' : 'border border-[#b83b3b]/60'} flex items-center justify-center`}>
                        
                        {/* Carved Ring 1 */}
                        <div className="w-[82%] h-[82%] rounded-full bg-gradient-to-b from-[#8a1919] via-[#630f0f] to-[#380606] p-[1px] sm:p-[2px] border border-[#9c2d2d]/30 flex items-center justify-center">
                            
                            {/* Carved Ring 2 */}
                            <div className="w-[70%] h-[70%] rounded-full bg-gradient-to-br from-[#6e1212] via-[#4d0a0a] to-[#260404] flex items-center justify-center border border-[#7d1d1d]/30">
                                
                                {/* Crown Emblem - Only shown for Kings */}
                                {isKing && (
                                    <svg 
                                        className="w-4 h-4 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-amber-300 scale-110" 
                                        fill="currentColor" 
                                        viewBox="0 0 24 24"
                                    >
                                        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                                    </svg>
                                )}

                            </div>
                        </div>

                        {/* Gloss Highlight */}
                        <div className="absolute top-0.5 left-2 right-2 h-2 bg-gradient-to-b from-white/20 to-transparent rounded-t-full pointer-events-none" />
                    </div>
                </div>
            )}

            {/* Player 2 Dama Piece (Carved Cream Birch Disc) */}
            {isP2 && (
                <div className={`relative w-8 h-8 sm:w-13 sm:h-13 md:w-16 md:h-16 lg:w-18 lg:h-18 xl:w-20 xl:h-20 flex items-center justify-center group transition-transform duration-200 ${isSelected ? '-translate-y-1 scale-105' : ''}`}>
                    {/* Shadow underneath */}
                    <div className="absolute inset-0 rounded-full bg-black/30 translate-y-1" />
                    
                    {/* Main Piece Disc */}
                    <div className={`relative w-full h-full rounded-full bg-gradient-to-b from-[#f7eee1] via-[#ebd5ba] to-[#bc9e7a] p-[2px] sm:p-[3px] shadow-[0_3px_5px_rgba(0,0,0,0.4)] ${isKing ? 'border-2 border-amber-600' : 'border border-[#e8d5bf]'} flex items-center justify-center`}>
                        
                        {/* Carved Ring 1 */}
                        <div className="w-[82%] h-[82%] rounded-full bg-gradient-to-b from-[#efe1ce] via-[#d6bfa3] to-[#aa8c68] p-[1px] sm:p-[2px] border border-[#d9c5ae] flex items-center justify-center">
                            
                            {/* Carved Ring 2 */}
                            <div className="w-[70%] h-[70%] rounded-full bg-gradient-to-br from-[#e0cfb8] via-[#c4aa8a] to-[#997a56] flex items-center justify-center border border-[#bfa483]">
                                
                                {/* Crown Emblem - Only shown for Kings */}
                                {isKing && (
                                    <svg 
                                        className="w-4 h-4 sm:w-6 sm:h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-amber-950 font-bold scale-110" 
                                        fill="currentColor" 
                                        viewBox="0 0 24 24"
                                    >
                                        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                                    </svg>
                                )}

                            </div>
                        </div>

                        {/* Gloss Highlight */}
                        <div className="absolute top-0.5 left-2 right-2 h-2 bg-gradient-to-b from-white/40 to-transparent rounded-t-full pointer-events-none" />
                    </div>
                </div>
            )}
        </div>
    );
}