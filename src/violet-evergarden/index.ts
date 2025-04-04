const isHumanBasedOnVioletEvergarden = (watched: boolean, cried: boolean) =>
  !watched
    ? (() => {
        throw new Error(
          'そもそも『ヴァイオレット・エヴァーガーデン』を見てないという予期せぬエラー',
        );
      })()
    : cried
      ? { isHuman: true }
      : { isHuman: false };

// 使用例
try {
  const result = isHumanBasedOnVioletEvergarden(true, true); // 見て泣いた
  console.log(result.isHuman ? '人間です。' : '人間ではありません。');
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
}
