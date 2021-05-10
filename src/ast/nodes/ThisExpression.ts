import MagicString from 'magic-string';
import { HasEffectsContext } from '../ExecutionContext';
import ModuleScope from '../scopes/ModuleScope';
import { ObjectPath, PathTracker } from '../utils/PathTracker';
import Variable from '../variables/Variable';
import * as NodeType from './NodeType';
import { ExpressionEntity, NodeEvent } from './shared/Expression';
import { NodeBase } from './shared/Node';

export default class ThisExpression extends NodeBase {
	type!: NodeType.tThisExpression;

	variable!: Variable;
	private alias!: string | null;
	private bound = false;

	// TODO Lukas remove bound check and other usages
	bind() {
		if (this.bound) return;
		this.bound = true;
		this.variable = this.scope.findVariable('this');
	}

	deoptimizePath(path: ObjectPath) {
		this.bind();
		this.variable.deoptimizePath(path);
	}

	deoptimizeThisOnEventAtPath(
		event: NodeEvent,
		path: ObjectPath,
		thisParameter: ExpressionEntity,
		recursionTracker: PathTracker
	) {
		this.bind();
		this.variable.deoptimizeThisOnEventAtPath(
			event,
			path,
			// We rewrite the parameter so that a ThisVariable can detect self-mutations
			thisParameter === this ? this.variable : thisParameter,
			recursionTracker
		);
	}

	hasEffectsWhenAccessedAtPath(path: ObjectPath, context: HasEffectsContext): boolean {
		return path.length > 0 && this.variable.hasEffectsWhenAccessedAtPath(path, context);
	}

	hasEffectsWhenAssignedAtPath(path: ObjectPath, context: HasEffectsContext): boolean {
		return this.variable.hasEffectsWhenAssignedAtPath(path, context);
	}

	include() {
		if (!this.included) {
			this.included = true;
			this.context.includeVariableInModule(this.variable);
		}
	}

	initialise() {
		this.alias =
			this.scope.findLexicalBoundary() instanceof ModuleScope ? this.context.moduleContext : null;
		if (this.alias === 'undefined') {
			this.context.warn(
				{
					code: 'THIS_IS_UNDEFINED',
					message: `The 'this' keyword is equivalent to 'undefined' at the top level of an ES module, and has been rewritten`,
					url: `https://rollupjs.org/guide/en/#error-this-is-undefined`
				},
				this.start
			);
		}
	}

	render(code: MagicString) {
		if (this.alias !== null) {
			code.overwrite(this.start, this.end, this.alias, {
				contentOnly: false,
				storeName: true
			});
		}
	}
}
