import React, {Fragment, useEffect, useState} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {Popover, Transition} from '@headlessui/react';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {IconSettings} from '@yearn-finance/web-lib/icons/IconSettings';

import type {ReactElement} from 'react';

export default function SettingsPopover(): ReactElement {
	const {slippage} = useSweepooor();
	const [slippageValue, set_slippageValue] = useState(0.1);

	useEffect((): void => {
		set_slippageValue((prev): number => {
			if (Number(slippage?.value || 0) > 0 && slippage.value !== prev) {
				return Number(slippage.value);
			}
			return prev;
		});
	}, [slippage.value]);

	return (
		<Popover className={'relative flex'}>
			{(): ReactElement => (
				<>
					<Popover.Button>
						<span className={'sr-only'}>{'Settings'}</span>
						<IconSettings className={'transition-color h-4 w-4 text-neutral-400 hover:text-neutral-900'} />
					</Popover.Button>
					<Transition
						as={Fragment}
						enter={'transition ease-out duration-200'}
						enterFrom={'opacity-0 translate-y-1'}
						enterTo={'opacity-100 translate-y-0'}
						leave={'transition ease-in duration-150'}
						leaveFrom={'opacity-100 translate-y-0'}
						leaveTo={'opacity-0 translate-y-1'}>
						<Popover.Panel className={'absolute right-0 top-6 isolate z-[1000] mt-3 w-screen max-w-[280px] md:-right-10 md:top-4'}>
							<div className={'relative rounded-md border border-neutral-900 bg-neutral-900 p-4'}>
								<div>
									<label
										htmlFor={'slippageTolerance'}
										className={'text-sm text-neutral-0'}>
										{'Slippage tolerance'}
									</label>
									<p className={'text-xs text-neutral-0/60'}>
										{'Your transaction will not be executed if the price changes unfavorably by more than this percentage.'}
									</p>
									<div className={'mt-4 flex flex-row space-x-2'}>
										<div className={`flex h-8 w-full min-w-[72px] items-center rounded-md border bg-neutral-100 px-0 md:min-w-[160px] ${slippageValue !== 1 && slippageValue !== 2 ? 'border-neutral-900' : 'border-transparent'}`}>
											<input
												id={'slippageTolerance'}
												type={'number'}
												min={0}
												step={0.1}
												max={100}
												className={'font-number h-8 w-full overflow-x-scroll border-none bg-transparent px-1.5 text-right outline-none scrollbar-none'}
												value={slippageValue}
												onChange={(e): void => {
													set_slippageValue(parseFloat(e.target.value) || 0);
												}} />
											<p className={'font-number pr-2 text-neutral-900/60'}>{'%'}</p>
										</div>
										<Button
											variant={'reverted'}
											className={'yearn--button !h-8 rounded-md !text-sm'}
											disabled={slippage.value === slippageValue}
											onClick={(): void => slippage.set(slippageValue)}>
											{'Confirm'}
										</Button>
									</div>
								</div>
							</div>
						</Popover.Panel>
					</Transition>
				</>
			)}
		</Popover>
	);
}
