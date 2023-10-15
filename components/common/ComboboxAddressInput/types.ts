import type {Dispatch, SetStateAction} from 'react';
import type {TToken} from 'utils/types';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';

export type TComboboxAddressInput = {
	value: TToken | null;
	possibleValues: TDict<TToken>;
	onChangeValue: (value: TToken) => void;
	onAddValue: Dispatch<SetStateAction<TDict<TToken>>>;
	shouldSort?: boolean;
};

export type TElement = {
	address: TAddress;
	symbol: string;
	chainId: number;
	logoURI?: string | undefined;
};
