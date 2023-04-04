import {ethers} from 'ethers';
import {isAddress} from 'ethers/lib/utils';
import lensProtocol from 'utils/lens.tools';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

export const MATIC_TOKEN_ADDRESS = toAddress('0x0000000000000000000000000000000000001010');
export const transition = {duration: 0.3, ease: [0.17, 0.67, 0.83, 1], height: {duration: 0}};
export const thumbnailVariants = {
	initial: {y: 20, opacity: 0, transition, height: 0},
	enter: {y: 0, opacity: 1, transition, height: 'auto'},
	exit: {y: -20, opacity: 1, transition, height: 'auto'}
};

export function handleInputChangeEventValue(e: React.ChangeEvent<HTMLInputElement>, decimals?: number): TNormalizedBN {
	const	{valueAsNumber, value} = e.target;
	const	amount = valueAsNumber;
	if (isNaN(amount)) {
		return ({raw: ethers.constants.Zero, normalized: ''});
	}
	if (amount === 0) {
		let		amountStr = value.replace(/,/g, '.').replace(/[^0-9.]/g, '');
		const	amountParts = amountStr.split('.');
		if ((amountParts[0])?.length > 1 && Number(amountParts[0]) === 0) {
			//
		} else {
			//check if we have 0 everywhere
			if (amountParts.every((part: string): boolean => Number(part) === 0)) {
				if (amountParts.length === 2) {
					amountStr = amountParts[0] + '.' + amountParts[1].slice(0, decimals);
				}
				const	raw = ethers.utils.parseUnits(amountStr || '0', decimals);
				return ({raw: raw, normalized: amountStr || '0'});
			}
		}
	}

	const	raw = ethers.utils.parseUnits(amount.toString() || '0', decimals);
	return ({raw: raw, normalized: amount.toString() || '0'});
}

export async function checkENSValidity(ens: string): Promise<[TAddress, boolean]> {
	const	resolvedName = await getProvider(1).resolveName(ens);
	if (resolvedName) {
		if (isAddress(resolvedName)) {
			return [toAddress(resolvedName), true];
		}
	}
	return [toAddress(ethers.constants.AddressZero), false];
}

export async function checkLensValidity(lens: string): Promise<[TAddress, boolean]> {
	const	resolvedName = await lensProtocol.getAddressFromHandle(lens);
	if (resolvedName) {
		if (isAddress(resolvedName)) {
			return [toAddress(resolvedName), true];
		}
	}
	return [toAddress(ethers.constants.AddressZero), false];
}
