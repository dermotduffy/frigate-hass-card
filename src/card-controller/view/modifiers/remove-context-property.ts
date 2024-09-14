import { ViewContext } from 'view';
import { View } from '../../../view/view';
import { ViewModifier } from '../types';

export class RemoveContextPropertyViewModifier implements ViewModifier {
  protected _key: keyof ViewContext;
  protected _property: PropertyKey;

  constructor(key: keyof ViewContext, property: PropertyKey) {
    this._key = key;
    this._property = property;
  }

  public modify(view: View): void {
    view.removeContextProperty(this._key, this._property);
  }
}
