import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AnalysisControls } from './analysis-controls';
import { ANALYSIS_PAGE } from './analysis-context';

/** Part of the AI analysis page; it reads and changes the page's state through {@link ANALYSIS_PAGE}. */
@Component({
  selector: 'app-analysis-settings',
  imports: [AnalysisControls],
  templateUrl: './analysis-settings.html',
  styleUrl: './analysis-page.css',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalysisSettings {
  protected readonly pg = inject(ANALYSIS_PAGE);
}
