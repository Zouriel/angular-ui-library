import { Component, signal } from '@angular/core';
import {
  UiBarChart, UiDonutChart, UiLineChart,
  type UiBarChartSeries, type UiChartSeries, type UiDonutSegment,
} from '@zouriel/ui/chart';
import { UiText } from '@zouriel/ui/text';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

@Component({
  selector: 'page-charts',
  imports: [UiBarChart, UiLineChart, UiDonutChart, UiText, DocPage, DocSection, DocDemo],
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

      <doc-section name="Line chart" selector="ui-line-chart" [api]="lineApi" [outputs]="outputs"
        shapes="interface UiChartSeries { name: string; values: (number | null)[]; color?: string; }"
        summary="One to four series over categories, with distinct marker shapes (circle, square, triangle, diamond) so colour is never the only difference. A null value creates a gap in the line. curve='smooth' uses monotone interpolation that never overshoots; area='true' fills under a single series at 12%; baseline='auto' fits a floating axis and prints its range in the caption.">
        <doc-demo code="<ui-line-chart ariaLabel=&quot;Monthly occupancy&quot; [categories]=&quot;months&quot;
  [series]=&quot;occupancy&quot; [area]=&quot;true&quot; curve=&quot;smooth&quot; baseline=&quot;auto&quot; />">
          <ui-text variant="label">Monthly occupancy (%)</ui-text>
          <ui-line-chart ariaLabel="Monthly occupancy" [categories]="months" [series]="occupancy"
            [area]="true" curve="smooth" baseline="auto" [minCategoryWidth]="36" />
        </doc-demo>
      </doc-section>

      <doc-section name="Multi-series line" selector="ui-line-chart [series]"
        summary="Up to four series share one plot with distinct markers and a legend. Null values break the line cleanly without inventing zero.">
        <doc-demo code="<ui-line-chart ariaLabel=&quot;Arrivals by region&quot; [categories]=&quot;months&quot; [series]=&quot;arrivals&quot; />">
          <ui-text variant="label">Arrivals by region</ui-text>
          <ui-line-chart ariaLabel="Arrivals by region" [categories]="months" [series]="arrivals" [minCategoryWidth]="36" />
        </doc-demo>
      </doc-section>

      <doc-section name="Donut chart" selector="ui-donut-chart" [api]="donutApi" [outputs]="donutOutputs"
        shapes="interface UiDonutSegment { name: string; value: number; color?: string; }"
        summary="Up to six segments with 2px gaps in the surface colour; more than six fold into Other. Shares under 3% still draw a minimum visible arc while the legend prints the true value and percentage. Draws clockwise from the top in LTR and counter-clockwise in RTL, with arrow-key navigation and a screen-reader table.">
        <doc-demo code="<ui-donut-chart ariaLabel=&quot;Bookings by channel&quot; [segments]=&quot;channels&quot;
  centerValue=&quot;1,240&quot; centerLabel=&quot;Bookings&quot;
  [selectedIndex]=&quot;segment()&quot; (segmentSelect)=&quot;segment.set($event)&quot; />">
          <ui-donut-chart ariaLabel="Bookings by channel" [segments]="channels"
            centerValue="1,240" centerLabel="Bookings"
            [selectedIndex]="segment()" (segmentSelect)="segment.set($event)" />
          <ui-text variant="caption">{{ segment() === null ? 'Choose a segment.' : channels[segment()!]?.name ?? 'Other' }}</ui-text>
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

  protected readonly occupancy: UiChartSeries[] = [
    { name: 'Occupancy', values: [68, 72, 75, 71, 64, 61, 69, 78, 82, 79, 85, 91] },
  ];
  protected readonly arrivals: UiChartSeries[] = [
    { name: 'Europe', values: [420, 460, 410, 390, 340, null, 380, 440, 490, 510, 560, 610] },
    { name: 'Asia', values: [280, 310, 330, 350, 360, 340, 390, 410, 430, 460, 490, 530] },
    { name: 'Middle East', values: [120, 140, 150, 130, 110, 125, 160, 180, 170, 190, 210, 240] },
  ];
  protected readonly segment = signal<number | null>(null);
  protected readonly channels: UiDonutSegment[] = [
    { name: 'Direct web', value: 520 },
    { name: 'Tour operators', value: 340 },
    { name: 'Online agencies', value: 210 },
    { name: 'Travel desks', value: 95 },
    { name: 'Corporate', value: 55 },
    { name: 'Walk-in', value: 12 },
    { name: 'Referral', value: 8 },
  ];
  protected readonly lineApi: ApiRow[] = [
    { name: 'ariaLabel', type: 'string (required)', default: '—', desc: 'Chart name for screen readers and table caption.' },
    { name: 'categories', type: 'string[]', default: '[]', desc: 'X-axis labels, oldest first.' },
    { name: 'series', type: 'UiChartSeries[]', default: '[]', desc: 'One to four series; null values create gaps.' },
    { name: 'formatValue', type: '(value: number) => string', default: 'locale number', desc: 'Formats numbers in axis, tooltip, labels and table.' },
    { name: 'height', type: 'number', default: '220', desc: 'Plot height in px.' },
    { name: 'area', type: 'boolean', default: 'false', desc: '12% area fill under a single series.' },
    { name: 'curve', type: "'linear' | 'smooth'", default: "'linear'", desc: 'smooth uses monotone interpolation without overshoot.' },
    { name: 'baseline', type: "'zero' | 'auto'", default: "'zero'", desc: 'auto fits a floating axis and prints the range in the caption.' },
    { name: 'showValues', type: 'boolean', default: 'false', desc: 'Print value at each point.' },
    { name: 'selectedIndex', type: 'number | null', default: '—', desc: 'Selected category index.' },
    { name: 'minCategoryWidth', type: 'number | null', default: 'null', desc: 'Minimum width per category before sideways scroll.' },
    { name: 'emptyLabel', type: 'string', default: 'No data', desc: 'Empty-state text.' },
  ];
  protected readonly donutApi: ApiRow[] = [
    { name: 'ariaLabel', type: 'string (required)', default: '—', desc: 'Chart name for screen readers and table caption.' },
    { name: 'segments', type: 'UiDonutSegment[]', default: '[]', desc: 'Up to 6 segments; extra segments fold into Other.' },
    { name: 'size', type: 'number', default: '180', desc: 'Outer diameter in px.' },
    { name: 'thickness', type: 'number', default: '24', desc: 'Ring thickness in px.' },
    { name: 'centerValue', type: 'string', default: '—', desc: 'Primary text in the middle of the ring.' },
    { name: 'centerLabel', type: 'string', default: '—', desc: 'Secondary label in the middle of the ring.' },
    { name: 'legend', type: "'end' | 'bottom' | 'none'", default: "'end'", desc: 'Legend placement.' },
    { name: 'formatValue', type: '(value: number) => string', default: 'locale number', desc: 'Formats segment values.' },
    { name: 'selectedIndex', type: 'number | null', default: '—', desc: 'Selected segment index.' },
    { name: 'emptyLabel', type: 'string', default: 'No data', desc: 'Empty-state text.' },
  ];
  protected readonly donutOutputs: ApiRow[] = [
    { name: 'segmentSelect', type: 'number', desc: 'A segment was clicked, tapped, or chosen with Enter or Space: its index.' },
  ];
}
