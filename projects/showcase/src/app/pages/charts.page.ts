import { Component, signal } from '@angular/core';
import { UiBarChart, type UiBarChartSeries } from '@zouriel/ui/chart';
import { UiText } from '@zouriel/ui/text';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Component({
  selector: 'page-charts',
  imports: [UiBarChart, UiText, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Components" title="Charts"
      lead="A bar chart for dashboards: thin columns from a zero baseline, a quiet grid, and colours each theme has checked for colour-blind readers. Every number is also in a table for screen readers.">

      <doc-section name="Bar chart" selector="ui-bar-chart" [api]="api" [outputs]="outputs"
        shapes="interface UiBarChartSeries { name: string; values: number[]; color?: string; }"
        summary="One series draws plain columns and needs no legend: say what is plotted in the heading above it. Bars are 24px wide at most and the y axis starts at zero on round numbers. Hover a category, tap it, or focus the chart and use the left and right arrow keys: a small panel shows its values. When there are more labels than fit, only every few are shown, counted back from the latest. With minCategoryWidth the plot scrolls sideways inside the chart once it gets narrower than that for every category, starting at the latest; the y axis stays where it is and the page never scrolls sideways. Set selectedIndex and listen to categorySelect to let people choose a category: the chosen one is tinted and its label is bold with a rule above it.">
        <doc-demo code="<ui-bar-chart ariaLabel=&quot;Sign-ups a day, last 30 days&quot; [categories]=&quot;days&quot;
  [series]=&quot;[{ name: 'Sign-ups', values: signUps }]&quot; [minCategoryWidth]=&quot;14&quot;
  [selectedIndex]=&quot;day()&quot; (categorySelect)=&quot;day.set($event)&quot; />">
          <ui-text variant="label">Sign-ups a day, last 30 days</ui-text>
          <ui-bar-chart ariaLabel="Sign-ups a day, last 30 days" [categories]="days" [series]="daily" [minCategoryWidth]="14"
            [selectedIndex]="day()" (categorySelect)="day.set($event)" />
          <ui-text variant="caption">{{ day() === null ? 'Choose a day.' : days[day()!] + ': ' + daily[0].values[day()!] + ' sign-ups' }}</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="Grouped bars" selector="ui-bar-chart [series]"
        summary="Two to four series sit side by side in each category, 2px apart, with a legend above. Series take the theme's chart colours in order (--ui-chart-1 to --ui-chart-4), or their own color. Names are always written in text colours, never in the series colour. Values below zero hang under the zero line. formatValue formats the axis, the panel, the value labels and the table.">
        <doc-demo code="<ui-bar-chart ariaLabel=&quot;Income and spending by month&quot; [categories]=&quot;months&quot; [series]=&quot;money&quot;
  [formatValue]=&quot;mvr&quot; [minCategoryWidth]=&quot;44&quot; />">
          <ui-text variant="label">Income and spending by month</ui-text>
          <ui-bar-chart ariaLabel="Income and spending by month" [categories]="months" [series]="money" [formatValue]="mvr" [minCategoryWidth]="44" />
        </doc-demo>
      </doc-section>

      <doc-section name="Value labels" selector="ui-bar-chart showValues"
        summary="showValues writes each value above its bar, in text ink. Use it when there are only a few bars; with many, leave the numbers to the axis and the panel.">
        <doc-demo code="<ui-bar-chart ariaLabel=&quot;Events this month and last&quot; [categories]=&quot;['Last month', 'This month']&quot;
  [series]=&quot;[{ name: 'Events', values: [18, 27] }]&quot; [showValues]=&quot;true&quot; [height]=&quot;160&quot; />">
          <div class="narrow">
            <ui-text variant="label">Events this month and last</ui-text>
            <ui-bar-chart ariaLabel="Events this month and last" [categories]="twoLabels" [series]="two" [showValues]="true" [height]="160" />
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="No data" selector="ui-bar-chart emptyLabel"
        summary="With no values, or when every value is zero, the axes stay and a quiet line says so. emptyLabel sets the words; without it the built-in No data is shown in the app's language.">
        <doc-demo code="<ui-bar-chart ariaLabel=&quot;Sales by month&quot; [categories]=&quot;months&quot;
  [series]=&quot;[{ name: 'Sales', values: [] }]&quot; emptyLabel=&quot;No data yet&quot; [height]=&quot;160&quot; />">
          <ui-text variant="label">Sales by month</ui-text>
          <ui-bar-chart ariaLabel="Sales by month" [categories]="months" [series]="none" emptyLabel="No data yet" [height]="160" />
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .narrow { display: flex; flex-direction: column; gap: var(--ui-space-3); max-width: 320px; }
  `,
})
export class ChartsPage {
  protected readonly months = MONTHS;
  protected readonly days = Array.from({ length: 30 }, (_, i) => `${i < 17 ? 'Oct' : 'Nov'} ${i < 17 ? i + 15 : i - 16}`);
  protected readonly daily: UiBarChartSeries[] = [{
    name: 'Sign-ups',
    values: [12, 18, 9, 14, 22, 31, 27, 16, 11, 19, 24, 38, 35, 21, 17, 13, 20, 26, 42, 39, 23, 18, 15, 28, 33, 47, 44, 29, 25, 36],
  }];
  protected readonly day = signal<number | null>(null);
  protected readonly money: UiBarChartSeries[] = [
    { name: 'Income', values: [4200, 5100, 4800, 6300, 7200, 6900, 8100, 7600, 5400, -1200, 6800, 9300] },
    { name: 'Spending', values: [3100, 3400, 3900, 4100, 4600, 5200, 4900, 5300, 5800, 4400, 4700, 5600] },
  ];
  protected readonly mvr = (v: number): string => `MVR ${v.toLocaleString('en-US')}`;
  protected readonly twoLabels = ['Last month', 'This month'];
  protected readonly two: UiBarChartSeries[] = [{ name: 'Events', values: [18, 27] }];
  protected readonly none: UiBarChartSeries[] = [{ name: 'Sales', values: [] }];

  protected readonly api: ApiRow[] = [
    { name: 'ariaLabel', type: 'string (required)', default: '—', desc: 'The chart\'s name: read by screen readers and used as the caption of the table that holds the numbers.' },
    { name: 'categories', type: 'string[]', default: '[]', desc: 'The x labels, one per category, oldest first.' },
    { name: 'series', type: 'UiBarChartSeries[]', default: '[]', desc: 'One to four series. One draws plain columns; more draw grouped bars with a legend. A missing value counts as 0.' },
    { name: 'formatValue', type: '(value: number) => string', default: 'locale number', desc: 'Formats a number for the axis, the panel, the value labels and the table.' },
    { name: 'height', type: 'number', default: '220', desc: 'Height of the plot in px. The x labels and the legend come on top of it.' },
    { name: 'showValues', type: 'boolean', default: 'false', desc: 'A value above each bar, in text ink. For charts with a few bars.' },
    { name: 'selectedIndex', type: 'number | null', default: '—', desc: 'The chosen category: tinted, its label bold with a rule above it. null for none.' },
    { name: 'minCategoryWidth', type: 'number | null', default: 'null', desc: 'Least width of one category in px. Narrower than that for all of them, the plot scrolls sideways inside the chart, starting at the latest.' },
    { name: 'emptyLabel', type: 'string', default: 'No data', desc: 'Shown over the axes when there is no data or every value is 0.' },
  ];
  protected readonly outputs: ApiRow[] = [
    { name: 'categorySelect', type: 'number', desc: 'A category was clicked, tapped, or chosen with Enter or Space: its index.' },
  ];
}
