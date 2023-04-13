import React, {useState} from 'react';
import Image from 'next/image';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';

import type {ImageProps} from 'next/image';
import type {CSSProperties, ReactElement} from 'react';

function	ImageWithFallback(props: ImageProps): ReactElement {
	const {alt, src, ...rest} = props;
	const [imageSrc, set_imageSrc] = useState(src);
	const [imageStyle, set_imageStyle] = useState<CSSProperties>({});

	if (alt === toAddress('0xDEf1CA1fb7FBcDC777520aa7f396b4E015F497aB')) {
		return (
			<Image
				alt={alt}
				src={'/cow.svg'}
				style={imageStyle}
				loading={'eager'}
				onError={(): void => {
					performBatchedUpdates((): void => {
						set_imageSrc('/placeholder.png');
						set_imageStyle({filter: 'opacity(0.2)'});
					});
				}}
				{...rest}
			/>
		);
	}

	return (
		<Image
			alt={alt}
			src={imageSrc}
			style={imageStyle}
			loading={'eager'}
			onError={(): void => {
				performBatchedUpdates((): void => {
					set_imageSrc('/placeholder.png');
					set_imageStyle({filter: 'opacity(0.2)'});
				});
			}}
			{...rest}
		/>
	);
}

export {ImageWithFallback};
